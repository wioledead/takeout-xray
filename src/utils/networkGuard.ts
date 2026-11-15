export interface NetworkLogEntry {
  id: number;
  timestamp: string;
  kind: 'fetch' | 'xhr' | 'beacon' | 'resource';
  url: string;
  bytesSent: number;
  external: boolean;
  phase: 'init' | 'post-init';
}

export interface NetworkTelemetryState {
  bytesSentAfterLoad: number;
  externalRequestsCount: number;
  logEntries: NetworkLogEntry[];
  isZeroExfiltration: boolean;
  initialized: boolean;
}

type Listener = () => void;

class NetworkGuardMonitor {
  private installed = false;
  private initialized = false;
  private initializedPerfTime = 0;
  private nextId = 1;
  private bytesSentAfterLoad = 0;
  private externalRequestsCount = 0;
  private entries: NetworkLogEntry[] = [];
  private listeners = new Set<Listener>();
  private snapshot: NetworkTelemetryState = {
    bytesSentAfterLoad: 0,
    externalRequestsCount: 0,
    logEntries: [],
    isZeroExfiltration: true,
    initialized: false,
  };

  install(): void {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;

    this.patchFetch();
    this.patchBeacon();
    this.patchXhr();
    this.attachPerformanceObserver();
  }

  markInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.initializedPerfTime = typeof performance !== 'undefined' ? performance.now() : 0;
    this.emitSnapshot();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): NetworkTelemetryState => {
    return this.snapshot;
  };

  private emitSnapshot(): void {
    this.snapshot = {
      bytesSentAfterLoad: this.bytesSentAfterLoad,
      externalRequestsCount: this.externalRequestsCount,
      logEntries: [...this.entries],
      isZeroExfiltration: this.bytesSentAfterLoad === 0 && this.externalRequestsCount === 0,
      initialized: this.initialized,
    };
    for (const listener of this.listeners) {
      listener();
    }
  }

  private isLocalAssetUrl(rawUrl: string): boolean {
    if (!rawUrl) return true;
    if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:') || rawUrl.startsWith('/')) {
      return true;
    }
    try {
      const parsed = new URL(rawUrl, window.location.href);
      return parsed.origin === window.location.origin;
    } catch {
      return true;
    }
  }

  private recordEntry(
    kind: NetworkLogEntry['kind'],
    rawUrl: string,
    bytesSent: number,
  ): void {
    if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
      return;
    }

    const external = !this.isLocalAssetUrl(rawUrl);
    const phase: NetworkLogEntry['phase'] = this.initialized ? 'post-init' : 'init';

    if (this.initialized) {
      this.bytesSentAfterLoad += bytesSent;
      if (external) {
        this.externalRequestsCount += 1;
      }
    }

    const entry: NetworkLogEntry = {
      id: this.nextId++,
      timestamp: new Date().toISOString().split('T')[1]?.replace('Z', '') ?? '',
      kind,
      url: rawUrl,
      bytesSent,
      external,
      phase,
    };

    this.entries = [entry, ...this.entries.slice(0, 99)];
    this.emitSnapshot();
  }

  private measureBodyBytes(body: unknown): number {
    if (!body) return 0;
    if (typeof body === 'string') return new TextEncoder().encode(body).byteLength;
    if (body instanceof ArrayBuffer) return body.byteLength;
    if (ArrayBuffer.isView(body)) return body.byteLength;
    if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size;
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
      return new TextEncoder().encode(body.toString()).byteLength;
    }
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      let approx = 0;
      body.forEach((v, k) => {
        approx += k.length + (typeof v === 'string' ? v.length : v.size);
      });
      return approx;
    }
    return 0;
  }

  private patchFetch(): void {
    if (typeof window.fetch !== 'function') return;
    const origFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const bytes = this.measureBodyBytes(init?.body);
      this.recordEntry('fetch', url, bytes);
      return origFetch(input, init);
    };
  }

  private patchBeacon(): void {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
    const origBeacon = navigator.sendBeacon.bind(navigator);

    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null): boolean => {
      const urlStr = typeof url === 'string' ? url : url.href;
      const bytes = Math.max(1, this.measureBodyBytes(data));
      this.recordEntry('beacon', urlStr, bytes);
      return origBeacon(url, data);
    };
  }

  private patchXhr(): void {
    if (typeof XMLHttpRequest === 'undefined') return;
    const monitor = this;
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    const urlMap = new WeakMap<XMLHttpRequest, string>();

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      urlMap.set(this, typeof url === 'string' ? url : url.href);
      return origOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const targetUrl = urlMap.get(this) ?? 'unknown';
      const bytes = monitor.measureBodyBytes(body);
      monitor.recordEntry('xhr', targetUrl, bytes);
      return origSend.call(this, body as XMLHttpRequestBodyInit | null | undefined);
    };
  }

  private attachPerformanceObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!this.initialized) continue;
          if (entry.startTime < this.initializedPerfTime) continue;
          const url = entry.name;
          if (url.startsWith('blob:') || url.startsWith('data:')) continue;
          // Only record non-local external resource observations post-init
          if (!this.isLocalAssetUrl(url)) {
            this.recordEntry('resource', url, 0);
          }
        }
      });
      observer.observe({ type: 'resource', buffered: false });
    } catch {
      // Ignore environments without resource PerformanceObserver support
    }
  }
}

export const networkGuard = new NetworkGuardMonitor();
