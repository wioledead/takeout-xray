import type { ExportFormat, Language } from '../types/domain';

export interface TranslationDictionary {
  app: {
    brand: string;
    tagline: string;
    localBadge: string;
    zeroBytesSent: string;
    bytesSentLabel: string;
    extReqAlert: string;
    wrappedBtn: string;
    loadNewBtn: string;
    allThreads: string;
    threadLabel: string;
    sourceLabel: string;
  };
  formats: Record<ExportFormat, string>;
  tabs: {
    overview: string;
    behavior: string;
    lexicon: string;
    sql: string;
  };
  dropzone: {
    title: string;
    subtitle: string;
    dropActive: string;
    browseBtn: string;
    supportedTitle: string;
    supportedTg: string;
    supportedGpt: string;
    supportedChrome: string;
    demoTitle: string;
    demoTgTitle: string;
    demoTgDesc: string;
    demoGptTitle: string;
    demoGptDesc: string;
    demoChromeTitle: string;
    demoChromeDesc: string;
    privacyTitle: string;
    privacyDesc: string;
    phaseDetecting: string;
    phaseStreaming: string;
    phaseIndexing: string;
    phaseReady: string;
    rowsProcessed: string;
    throughput: string;
    threadsFound: string;
    errorPrefix: string;
    unsupportedFormat: string;
  };
  overview: {
    totalEvents: string;
    totalVisits: string;
    activeDays: string;
    totalWords: string;
    uniqueDomains: string;
    mediaAttachments: string;
    threadsCount: string;
    dateSpan: string;
    serviceEvents: string;
    regeneratedBranches: string;
    heatmapTitle: string;
    heatmapDesc: string;
    timelineTitle: string;
    timelineDesc: string;
    participantsTitle: string;
    participantsDesc: string;
    senderCol: string;
    eventsCol: string;
    wordsCol: string;
    shareCol: string;
    less: string;
    more: string;
    daysShort: [string, string, string, string, string, string, string];
  };
  behavior: {
    initiatorTitle: string;
    initiatorDesc: string;
    sessionsStarted: string;
    latencyTitle: string;
    latencyDesc: string;
    medianReply: string;
    repliesCount: string;
    monologueTitle: string;
    monologueDesc: string;
    maxStreak: string;
    avgTurn: string;
    monologues5Plus: string;
    circadianTitle: string;
    circadianDesc: string;
    nightOwlScore: string;
    nightOwlDesc: string;
    peakHour: string;
    noInitiatorData: string;
    noReplyData: string;
    noMonologueData: string;
    chromeBehaviorNote: string;
  };
  lexicon: {
    topWordsTitle: string;
    topWordsDesc: string;
    yearlyTitle: string;
    yearlyDesc: string;
    allYears: string;
    emojiTitle: string;
    emojiDesc: string;
    noEmojis: string;
    questionsTitle: string;
    questionsDesc: string;
    questionsPer100: string;
    gptLensTitle: string;
    gptLensDesc: string;
    gptUserVsAssistant: string;
    gptPoliteness: string;
    gptCodeDensity: string;
    gptRegenBranches: string;
    gptPeakHour: string;
    chromeLensTitle: string;
    chromeLensDesc: string;
    chromeTopDomains: string;
    chromeTransitions: string;
    chromeRabbitHoles: string;
    visits: string;
    streak: string;
  };
  sql: {
    title: string;
    subtitle: string;
    runBtn: string;
    running: string;
    shortcutHint: string;
    presetsTitle: string;
    schemaTitle: string;
    copyCsv: string;
    copied: string;
    execTime: string;
    rowsReturned: string;
    truncatedNotice: string;
    emptyResult: string;
    presets: {
      monologues: string;
      lateNight: string;
      domains: string;
      hourlyVolume: string;
      emojis: string;
      responseTimes: string;
    };
  };
  networkModal: {
    title: string;
    subtitle: string;
    statusClean: string;
    statusAlert: string;
    bytesSent: string;
    externalRequests: string;
    observedCount: string;
    colTime: string;
    colKind: string;
    colUrl: string;
    colBytes: string;
    emptyLog: string;
    close: string;
  };
  shareModal: {
    title: string;
    subtitle: string;
    anonymize: string;
    downloadPng: string;
    exporting: string;
    exportFailed: string;
    close: string;
    cardHeader: string;
    cardFooter: string;
    topInitiator: string;
    replySpeed: string;
    nightOwl: string;
    peakHour: string;
    topWords: string;
    topEmojis: string;
    topDomains: string;
    gptPolite: string;
  };
}

export const DICTIONARY: Record<Language, TranslationDictionary> = {
  en: {
    app: {
      brand: 'TAKEOUT // X-RAY',
      tagline: '100% Client-Side Personal Data Forensics',
      localBadge: 'LOCAL DUCKDB-WASM',
      zeroBytesSent: '0 B SENT AFTER LOAD',
      bytesSentLabel: 'SENT AFTER LOAD',
      extReqAlert: 'EXT REQ AFTER LOAD',
      wrappedBtn: 'X-Ray Wrapped',
      loadNewBtn: 'Load New Export',
      allThreads: 'ALL THREADS',
      threadLabel: 'THREAD',
      sourceLabel: 'SOURCE',
    },
    formats: {
      tg_chat: 'TELEGRAM CHAT',
      tg_account: 'TELEGRAM ACCOUNT',
      chatgpt: 'CHATGPT ARCHIVE',
      chrome_history: 'CHROME HISTORY',
    },
    tabs: {
      overview: 'Overview',
      behavior: 'Behavior & Dynamics',
      lexicon: 'Lexicon & Lenses',
      sql: 'SQL Console',
    },
    dropzone: {
      title: 'DROP PERSONAL EXPORT JSON',
      subtitle: 'Stream-parsed in a local Web Worker + DuckDB-Wasm. Supports 500MB+ files without freezing your browser.',
      dropActive: 'RELEASE TO INITIATE LOCAL X-RAY SCAN',
      browseBtn: 'Select JSON File',
      supportedTitle: 'SUPPORTED FORENSIC FORMATS',
      supportedTg: 'Telegram Desktop (result.json — single chat or full account export)',
      supportedGpt: 'OpenAI ChatGPT Export (conversations.json DAG mapping)',
      supportedChrome: 'Google Takeout Chrome (BrowserHistory.json)',
      demoTitle: 'INSTANT CLIENT-SIDE DEMOS (SYNTHETIC DATA)',
      demoTgTitle: 'Telegram Demo',
      demoTgDesc: '~15,000 bilingual messages across 3 threads',
      demoGptTitle: 'ChatGPT Demo',
      demoGptDesc: '~300 conversations with regenerated branches',
      demoChromeTitle: 'Chrome Demo',
      demoChromeDesc: '~10,000 browser visits & rabbit holes',
      privacyTitle: 'ZERO-EXFILTRATION GUARANTEE',
      privacyDesc: 'No backend. No cloud upload. Files stream in 64KB slices straight into in-browser DuckDB-Wasm tables.',
      phaseDetecting: 'SNIFFING EXPORT SIGNATURE...',
      phaseStreaming: 'STREAMING & BATCHING INTO DUCKDB...',
      phaseIndexing: 'COMPUTING FORENSIC TELEMETRY...',
      phaseReady: 'ANALYSIS COMPLETE',
      rowsProcessed: 'ROWS INGESTED',
      throughput: 'THROUGHPUT',
      threadsFound: 'THREADS',
      errorPrefix: 'INGESTION FAILED',
      unsupportedFormat:
        'Unrecognized JSON structure. Expected Telegram (result.json), ChatGPT (conversations.json), or Google Takeout Chrome (BrowserHistory.json).',
    },
    overview: {
      totalEvents: 'Total Events',
      totalVisits: 'Total Visits',
      activeDays: 'Active Days',
      totalWords: 'Total Words',
      uniqueDomains: 'Media / Domains',
      mediaAttachments: 'Media & Files',
      threadsCount: 'Threads / Chats',
      dateSpan: 'Time Horizon',
      serviceEvents: 'Service Events',
      regeneratedBranches: 'Regenerated Branches',
      heatmapTitle: '24 × 7 Circadian Activity Matrix',
      heatmapDesc: 'Local timezone intensity across day-of-week and hour-of-day',
      timelineTitle: 'Temporal Activity Pulse',
      timelineDesc: 'Volume trajectory across export timeline',
      participantsTitle: 'Entity & Volume Distribution',
      participantsDesc: 'Share of events, words, and character footprint',
      senderCol: 'Participant / Entity',
      eventsCol: 'Events',
      wordsCol: 'Words',
      shareCol: 'Share',
      less: 'Quiet',
      more: 'Peak',
      daysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    behavior: {
      initiatorTitle: 'Conversation Initiator Index',
      initiatorDesc: 'Who breaks a 6+ hour silence gap to restart dialogue',
      sessionsStarted: 'sessions opened',
      latencyTitle: 'Median Response Latency',
      latencyDesc: 'True median reply speed (excludes 6h+ sleep gaps & same-sender bursts)',
      medianReply: 'median reply',
      repliesCount: 'replies',
      monologueTitle: 'Monologue & Double-Texting Streaks',
      monologueDesc: 'Longest consecutive uninterrupted message chains per sender',
      maxStreak: 'Max Streak',
      avgTurn: 'Avg / Turn',
      monologues5Plus: '5+ Chains',
      circadianTitle: 'Hourly Activity Distribution',
      circadianDesc: '24-hour fingerprint in your local timezone',
      nightOwlScore: 'Night Owl Index (00:00–05:00)',
      nightOwlDesc: 'Share of total events logged after midnight',
      peakHour: 'Peak Hour',
      noInitiatorData: 'No conversation session starts recorded in this selection.',
      noReplyData: 'Need at least 2 alternating participants within 6h windows to measure reply latency.',
      noMonologueData: 'Monologue streaks apply to message threads with dialogue turns.',
      chromeBehaviorNote: 'Chrome browsing mode tracks session openings (6h+ idle gaps) and domain streaks across devices.',
    },
    lexicon: {
      topWordsTitle: 'Top Vocabulary (Stopwords Filtered)',
      topWordsDesc: 'Most frequent 3+ char EN/RU tokens excluding function words',
      yearlyTitle: 'Vocabulary Evolution by Year',
      yearlyDesc: 'Compare shifting linguistic signatures across years',
      allYears: 'Overall',
      emojiTitle: 'Emoji Telemetry',
      emojiDesc: 'Unicode pictographs extracted during stream normalization',
      noEmojis: 'No Unicode emojis detected in this selection.',
      questionsTitle: 'Curiosity & Question Density',
      questionsDesc: 'Questions asked per 100 messages by participant',
      questionsPer100: 'questions / 100 msgs',
      gptLensTitle: 'ChatGPT Prompt Forensics Lens',
      gptLensDesc: 'Inspect human-vs-model footprint, politeness, code density & abandoned DAG branches',
      gptUserVsAssistant: 'User vs Assistant Chars',
      gptPoliteness: 'Polite Prompts (please/thanks)',
      gptCodeDensity: 'Messages with Code Blocks',
      gptRegenBranches: 'Discarded / Regenerated Branches',
      gptPeakHour: 'Peak Prompting Hour',
      chromeLensTitle: 'Chrome Navigation Forensics Lens',
      chromeLensDesc: 'Top domains, navigation transitions & single-domain rabbit holes',
      chromeTopDomains: 'Top Visited Domains',
      chromeTransitions: 'Page Transition Types',
      chromeRabbitHoles: 'Longest Domain Rabbit Holes',
      visits: 'visits',
      streak: 'consecutive visits',
    },
    sql: {
      title: 'Live DuckDB-Wasm SQL Console',
      subtitle: 'Query normalized tables directly in your browser (read-only sandbox, 500-row cap)',
      runBtn: 'Execute SQL',
      running: 'Running...',
      shortcutHint: 'Ctrl / Cmd + Enter',
      presetsTitle: 'FORENSIC PRESETS',
      schemaTitle: 'DUCKDB SCHEMA',
      copyCsv: 'Copy CSV',
      copied: 'Copied!',
      execTime: 'Exec time',
      rowsReturned: 'Rows',
      truncatedNotice: 'Display capped at 500 rows to protect DOM responsiveness.',
      emptyResult: 'Query executed cleanly and returned 0 rows.',
      presets: {
        monologues: 'Top 10 Longest Monologues',
        lateNight: 'Late Night Activity (00:00–05:00)',
        domains: 'Most Shared / Visited Domains',
        hourlyVolume: 'Hourly Volume & Words',
        emojis: 'Emoji Leaderboard',
        responseTimes: 'Median Reply Latency SQL',
      },
    },
    networkModal: {
      title: 'LIVE NETWORK TELEMETRY AUDIT',
      subtitle: 'Monitored continuously via PerformanceObserver + fetch/XHR/sendBeacon wrappers',
      statusClean: 'ZERO DATA EXFILTRATION VERIFIED — 0 BYTES SENT',
      statusAlert: 'OUTGOING PAYLOAD DETECTED',
      bytesSent: 'Bytes Sent After Init',
      externalRequests: 'External Requests',
      observedCount: 'Observed Browser Entries',
      colTime: 'Time',
      colKind: 'Type',
      colUrl: 'Target',
      colBytes: 'Sent Bytes',
      emptyLog: 'No post-initialization outgoing network payloads recorded.',
      close: 'Close',
    },
    shareModal: {
      title: 'X-Ray Wrapped Poster Generator',
      subtitle: 'Export a high-res 1080×1350 Cyber-Terminal telemetry poster locally as PNG',
      anonymize: 'Anonymize Names',
      downloadPng: 'Download PNG',
      exporting: 'Rendering PNG...',
      exportFailed: 'Failed to export PNG image in this browser.',
      close: 'Close',
      cardHeader: 'PERSONAL DATA FORENSICS // WRAPPED',
      cardFooter: '100% LOCAL · DUCKDB-WASM · 0 BYTES EXFILTRATED',
      topInitiator: 'Top Initiator',
      replySpeed: 'Median Reply',
      nightOwl: 'Night Owl',
      peakHour: 'Peak Hour',
      topWords: 'Top Vocabulary',
      topEmojis: 'Signature Emojis',
      topDomains: 'Top Domains',
      gptPolite: 'Polite Prompts',
    },
  },
  ru: {
    app: {
      brand: 'TAKEOUT // X-RAY',
      tagline: '100% локальная аналитика персональных архивов',
      localBadge: 'ЛОКАЛЬНЫЙ DUCKDB-WASM',
      zeroBytesSent: '0 Б ОТПРАВЛЕНО ПОСЛЕ ЗАГРУЗКИ',
      bytesSentLabel: 'ОТПРАВЛЕНО',
      extReqAlert: 'ВНЕШНИХ ЗАПРОСОВ',
      wrappedBtn: 'X-Ray Итоги',
      loadNewBtn: 'Новый файл',
      allThreads: 'ВСЕ ДИАЛОГИ',
      threadLabel: 'ДИАЛОГ',
      sourceLabel: 'ИСТОЧНИК',
    },
    formats: {
      tg_chat: 'TELEGRAM ЧАТ',
      tg_account: 'TELEGRAM АККАУНТ',
      chatgpt: 'АРХИВ CHATGPT',
      chrome_history: 'ИСТОРИЯ CHROME',
    },
    tabs: {
      overview: 'Обзор',
      behavior: 'Поведение и ритм',
      lexicon: 'Лексикон и линзы',
      sql: 'SQL Консоль',
    },
    dropzone: {
      title: 'ПЕРЕТАЩИТЕ JSON-ЭКСПОРТ СЮДА',
      subtitle: 'Потоковый парсинг внутри Web Worker + DuckDB-Wasm. Файлы 500+ МБ обрабатываются без зависаний.',
      dropActive: 'ОТПУСТИТЕ ФАЙЛ ДЛЯ ЛОКАЛЬНОГО СКАНИРОВАНИЯ',
      browseBtn: 'Выбрать JSON-файл',
      supportedTitle: 'ПОДДЕРЖИВАЕМЫЕ ФОРМАТЫ',
      supportedTg: 'Telegram Desktop (result.json — отдельный чат или весь аккаунт)',
      supportedGpt: 'Экспорт OpenAI ChatGPT (conversations.json с деревом веток)',
      supportedChrome: 'Google Takeout Chrome (BrowserHistory.json)',
      demoTitle: 'МГНОВЕННЫЕ ДЕМО-ДАННЫЕ (СИНТЕТИКА)',
      demoTgTitle: 'Демо Telegram',
      demoTgDesc: '~15 000 двуязычных сообщений в 3 чатах',
      demoGptTitle: 'Демо ChatGPT',
      demoGptDesc: '~300 диалогов с ветками перегенерации',
      demoChromeTitle: 'Демо Chrome',
      demoChromeDesc: '~10 000 визитов и «кроличьих нор»',
      privacyTitle: 'ГАРАНТИЯ НУЛЕВОЙ ОТПРАВКИ',
      privacyDesc: 'Без бэкенда и облака. Данные читаются чанками по 64 КБ прямо в локальную БД DuckDB-Wasm.',
      phaseDetecting: 'ОПРЕДЕЛЕНИЕ СИГНАТУРЫ ФАЙЛА...',
      phaseStreaming: 'ПОТОКОВЫЙ ПАРСИНГ И ЗАГРУЗКА В DUCKDB...',
      phaseIndexing: 'РАСЧЁТ МЕТРИК...',
      phaseReady: 'АНАЛИЗ ЗАВЕРШЁН',
      rowsProcessed: 'СТРОК ЗАГРУЖЕНО',
      throughput: 'СКОРОСТЬ',
      threadsFound: 'ДИАЛОГОВ',
      errorPrefix: 'ОШИБКА ИМПОРТА',
      unsupportedFormat:
        'Неизвестная структура JSON. Поддерживаются экспорты Telegram (result.json), ChatGPT (conversations.json) и Chrome (BrowserHistory.json).',
    },
    overview: {
      totalEvents: 'Всего событий',
      totalVisits: 'Всего визитов',
      activeDays: 'Активных дней',
      totalWords: 'Всего слов',
      uniqueDomains: 'Медиа / домены',
      mediaAttachments: 'Медиа и файлы',
      threadsCount: 'Чаты / треды',
      dateSpan: 'Период',
      serviceEvents: 'Системные события',
      regeneratedBranches: 'Скрытые ветки',
      heatmapTitle: 'Матрица активности 24 × 7',
      heatmapDesc: 'Локальный часовой пояс: дни недели и часы суток',
      timelineTitle: 'Динамика активности во времени',
      timelineDesc: 'Объём событий по периодам экспорта',
      participantsTitle: 'Вклад участников',
      participantsDesc: 'Доля событий, слов и символов',
      senderCol: 'Участник / источник',
      eventsCol: 'События',
      wordsCol: 'Слова',
      shareCol: 'Доля',
      less: 'Тише',
      more: 'Пик',
      daysShort: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    },
    behavior: {
      initiatorTitle: 'Индекс инициатора',
      initiatorDesc: 'Кто чаще прерывает тишину длиной от 6 часов и начинает разговор',
      sessionsStarted: 'сессий начато',
      latencyTitle: 'Медианная скорость ответа',
      latencyDesc: 'Медиана исключает ночные паузы >6 ч и серии сообщений подряд',
      medianReply: 'медиана ответа',
      repliesCount: 'ответов',
      monologueTitle: 'Серии монологов',
      monologueDesc: 'Самые длинные цепочки сообщений подряд без ответа собеседника',
      maxStreak: 'Макс. серия',
      avgTurn: 'В среднем',
      monologues5Plus: 'Серий 5+',
      circadianTitle: 'Суточный профиль активности',
      circadianDesc: 'Распределение по часам в локальном часовом поясе',
      nightOwlScore: 'Индекс «Совы» (00:00–05:00)',
      nightOwlDesc: 'Доля активности после полуночи',
      peakHour: 'Пиковый час',
      noInitiatorData: 'В выбранном срезе нет зафиксированных стартов сессий.',
      noReplyData: 'Для расчёта скорости ответа нужно минимум 2 собеседника с окном ответа < 6 ч.',
      noMonologueData: 'Серии монологов рассчитываются для диалогов и чатов с сообщениями.',
      chromeBehaviorNote: 'Для истории браузера фиксируются старты новых сессий (после 6+ ч паузы) и суточный ритм.',
    },
    lexicon: {
      topWordsTitle: 'Топ-словарь (без стоп-слов)',
      topWordsDesc: 'Частые слова от 3 букв (EN/RU) с фильтрацией предлогов и местоимений',
      yearlyTitle: 'Эволюция словаря по годам',
      yearlyDesc: 'Переключайте годы для сравнения характерных тем',
      allYears: 'За всё время',
      emojiTitle: 'Рейтинг эмодзи',
      emojiDesc: 'Извлечено потоковым Unicode-анализатором',
      noEmojis: 'В выбранном срезе эмодзи не найдены.',
      questionsTitle: 'Индекс любознательности',
      questionsDesc: 'Сколько вопросов приходится на каждые 100 сообщений',
      questionsPer100: 'вопросов / 100 сообщ.',
      gptLensTitle: 'Спец-аналитика ChatGPT',
      gptLensDesc: 'Соотношение текста, вежливость промптов, доля кода и отброшенные ветки генераций',
      gptUserVsAssistant: 'Символы: Пользователь / ИИ',
      gptPoliteness: 'Вежливые промпты (please/спасибо)',
      gptCodeDensity: 'Сообщения с блоками кода',
      gptRegenBranches: 'Отброшенные ветки DAG',
      gptPeakHour: 'Пиковый час промптов',
      chromeLensTitle: 'Спец-аналитика Chrome',
      chromeLensDesc: 'Топ доменов, типы переходов и самые длинные серии визитов на один сайт',
      chromeTopDomains: 'Топ посещаемых доменов',
      chromeTransitions: 'Типы переходов (Transitions)',
      chromeRabbitHoles: 'Самые глубокие «кроличьи норы»',
      visits: 'визитов',
      streak: 'визитов подряд',
    },
    sql: {
      title: 'SQL-консоль DuckDB-Wasm',
      subtitle: 'Прямые аналитические запросы к таблицам в браузере (только чтение, лимит 500 строк)',
      runBtn: 'Выполнить SQL',
      running: 'Выполняется...',
      shortcutHint: 'Ctrl / Cmd + Enter',
      presetsTitle: 'ГОТОВЫЕ ПРЕСЕТЫ',
      schemaTitle: 'СХЕМА ТАБЛИЦ',
      copyCsv: 'Копировать CSV',
      copied: 'Скопировано!',
      execTime: 'Время',
      rowsReturned: 'Строк',
      truncatedNotice: 'Показаны первые 500 строк для плавности интерфейса.',
      emptyResult: 'Запрос выполнен успешно и вернул 0 строк.',
      presets: {
        monologues: 'Топ-10 длинных монологов',
        lateNight: 'Ночная активность (00:00–05:00)',
        domains: 'Самые частые домены',
        hourlyVolume: 'Объём и слова по часам',
        emojis: 'Лидерборд эмодзи',
        responseTimes: 'Медианное время ответа',
      },
    },
    networkModal: {
      title: 'АУДИТ СЕТЕВОЙ ТЕЛЕМЕТРИИ',
      subtitle: 'Непрерывный контроль через PerformanceObserver + перехват fetch/XHR/sendBeacon',
      statusClean: 'УТЕЧКА ДАННЫХ ИСКЛЮЧЕНА — ОТПРАВЛЕНО 0 БАЙТ',
      statusAlert: 'ОБНАРУЖЕНА ИСХОДЯЩАЯ АКТИВНОСТЬ',
      bytesSent: 'Отправлено после старта',
      externalRequests: 'Внешние запросы',
      observedCount: 'Записей в журнале',
      colTime: 'Время',
      colKind: 'Тип',
      colUrl: 'Цель',
      colBytes: 'Отправлено',
      emptyLog: 'Исходящих сетевых отправок после инициализации не зафиксировано.',
      close: 'Закрыть',
    },
    shareModal: {
      title: 'Генератор карточки X-Ray Wrapped',
      subtitle: 'Локальный рендер постера 1080×1350 в формате PNG без отправки на сервер',
      anonymize: 'Анонимизировать имена',
      downloadPng: 'Скачать PNG',
      exporting: 'Генерация PNG...',
      exportFailed: 'Не удалось отрендерить PNG в текущем браузере.',
      close: 'Закрыть',
      cardHeader: 'ПЕРСОНАЛЬНЫЙ АНАЛИЗ ДАННЫХ // WRAPPED',
      cardFooter: '100% ЛОКАЛЬНО · DUCKDB-WASM · 0 БАЙТ ОТПРАВЛЕНО',
      topInitiator: 'Главный инициатор',
      replySpeed: 'Медиана ответа',
      nightOwl: 'Индекс совы',
      peakHour: 'Пиковый час',
      topWords: 'Топ-слова',
      topEmojis: 'Главные эмодзи',
      topDomains: 'Топ-домены',
      gptPolite: 'Вежливые промпты',
    },
  },
};
