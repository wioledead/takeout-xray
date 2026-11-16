import type { Language } from '../types/domain';

export type GuideServiceId =
  | 'antigravity'
  | 'claude_code'
  | 'telegram'
  | 'whatsapp'
  | 'discord'
  | 'chatgpt'
  | 'claude_ai'
  | 'chrome_history'
  | 'youtube'
  | 'spotify'
  | 'tiktok'
  | 'twitter';

export interface ExportGuidePath {
  label: string;
  value: string;
}

export interface ExportGuideEntry {
  id: GuideServiceId;
  name: string;
  badgeColor: string;
  expectedFiles: string;
  steps: string[];
  tip?: string;
  paths?: ExportGuidePath[];
}

export const EXPORT_GUIDES: Record<Language, ExportGuideEntry[]> = {
  en: [
    {
      id: 'antigravity',
      name: 'Antigravity 2.0',
      badgeColor: '#A855F7',
      expectedFiles: 'brain/ folder · transcript_full.jsonl · transcript.jsonl · .zip',
      steps: [
        'Click "Select Folder" above and choose your local Antigravity brain directory (or drag it straight onto the dropzone).',
        'Alternatively, drop individual transcript_full.jsonl / transcript.jsonl files or a zipped backup.',
        'If both transcript_full.jsonl and transcript.jsonl sit in the same session folder, full transcripts are selected automatically without duplicating rows.',
      ],
      paths: [
        { label: 'Windows', value: '%USERPROFILE%\\.gemini\\antigravity\\brain' },
        { label: 'macOS / Linux', value: '~/.gemini/antigravity/brain' },
      ],
    },
    {
      id: 'claude_code',
      name: 'Claude Code CLI',
      badgeColor: '#C084FC',
      expectedFiles: '~/.claude/projects/ folder · <session-uuid>.jsonl · .zip',
      steps: [
        'Click "Select Folder" and pick your local ~/.claude/projects directory (or a single project subfolder).',
        'You can also multi-select specific session .jsonl logs or drop a zipped projects backup.',
        'Repeated streaming fragments sharing the same message.id are deduplicated automatically so KV cache and token totals stay accurate.',
      ],
      paths: [
        { label: 'Windows', value: '%USERPROFILE%\\.claude\\projects' },
        { label: 'macOS / Linux', value: '~/.claude/projects' },
      ],
    },
    {
      id: 'telegram',
      name: 'Telegram',
      badgeColor: '#00FF9D',
      expectedFiles: 'result.json (single chat or full account) · .zip',
      steps: [
        'Open Telegram Desktop (mobile apps do not support JSON export).',
        'For a single chat: open chat → ⋮ menu → Export chat history. For your whole account: Settings → Advanced → Export Telegram data.',
        'Under Format, switch from HTML to "Machine-readable JSON". Uncheck heavy media if you only want text & behavioral metrics.',
        'Drop result.json or a .zip archive directly here.',
      ],
      tip: 'Telegram Desktop defaults to HTML — make sure to pick Machine-readable JSON.',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      badgeColor: '#22C55E',
      expectedFiles: '_chat.txt · WhatsApp Chat with ....txt · .zip',
      steps: [
        'On Android: open any chat → ⋮ → More → Export chat → Without media.',
        'On iOS: open any chat → tap contact/group title → Export Chat → Without Media.',
        'Drop the exported .zip archive directly (no need to unzip) or the extracted .txt file.',
      ],
      tip: 'Both iOS [DD/MM/YY, HH:MM:SS] and Android DD/MM/YYYY, HH:MM formats (plus DMY vs MDY) are detected automatically.',
    },
    {
      id: 'discord',
      name: 'Discord',
      badgeColor: '#818CF8',
      expectedFiles: 'Data Package .zip · messages/ folder · DiscordChatExporter .json',
      steps: [
        'Official Data Package: User Settings → Privacy & Safety → "Request all of my Data". Wait for Discord\'s email and drop the .zip (or extracted messages/ folder) here.',
        'Channel names and DM recipients are resolved automatically from messages/index.json when dropping the .zip or messages/ folder.',
        'DiscordChatExporter users: export any channel in JSON format and drop the .json file directly.',
      ],
    },
    {
      id: 'chatgpt',
      name: 'OpenAI ChatGPT',
      badgeColor: '#38BDF8',
      expectedFiles: 'ChatGPT export .zip · conversations.json',
      steps: [
        'Go to chatgpt.com → Settings → Data controls → Export data → Confirm export.',
        'Open the download link from OpenAI\'s email to save the .zip archive.',
        'Drop the .zip directly onto the zone (or extract and drop conversations.json).',
      ],
    },
    {
      id: 'claude_ai',
      name: 'Claude.ai',
      badgeColor: '#FB923C',
      expectedFiles: 'Claude export .zip · conversations.json',
      steps: [
        'Open claude.ai → Settings → Account / Privacy → Export Data.',
        'Download the .zip archive sent to your email.',
        'Drop the .zip file directly (or extract conversations.json) — thinking blocks and code density are analyzed locally.',
      ],
    },
    {
      id: 'chrome_history',
      name: 'Google Chrome',
      badgeColor: '#F59E0B',
      expectedFiles: 'Takeout .zip · BrowserHistory.json / History.json',
      steps: [
        'Visit takeout.google.com and click "Deselect all".',
        'Check "Chrome" (includes BrowserHistory.json in JSON format by default).',
        'Create export, download the .zip, and drop it straight here — multi-service Google Takeout .zip archives let you pick Chrome with one click.',
      ],
    },
    {
      id: 'youtube',
      name: 'YouTube',
      badgeColor: '#F43F5E',
      expectedFiles: 'Takeout .zip · watch-history.json',
      steps: [
        'Visit takeout.google.com → Deselect all → check "YouTube and YouTube Music".',
        'Click "Multiple formats" and change History format from HTML to JSON.',
        'Download the .zip and drop it straight here (or drop watch-history.json).',
      ],
      tip: 'By default Google Takeout exports YouTube History as HTML — switch History format to JSON before exporting.',
    },
    {
      id: 'spotify',
      name: 'Spotify',
      badgeColor: '#10B981',
      expectedFiles: '.zip · Streaming_History_Audio_*.json · StreamingHistory*.json',
      steps: [
        'Go to spotify.com/account/privacy in your browser.',
        'Request "Extended streaming history" (full lifetime logs with skip, shuffle, platform & album fields) or "Account data" (last 12 months).',
        'Drop the .zip directly, or multi-select all Streaming_History_Audio_*.json files at once.',
      ],
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      badgeColor: '#EC4899',
      expectedFiles: '.zip · user_data_tiktok.json',
      steps: [
        'Open TikTok → Settings and privacy → Account → Download your data.',
        'Change "Select file format" from TXT to JSON, then tap Request data.',
        'Once ready, drop the downloaded .zip directly or upload user_data_tiktok.json.',
      ],
      tip: 'Make sure "JSON" is selected instead of "TXT" before requesting the TikTok archive.',
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      badgeColor: '#38BDF8',
      expectedFiles: '.zip · data/tweets.js · data/like.js · data/direct-messages.js',
      steps: [
        'Open X (x.com) → More → Settings and privacy → Your account → Download an archive of your data.',
        'Verify your password/2FA code and click Request archive (X prepares the .zip within ~24 hours).',
        'Drop the downloaded .zip directly here — or select data/tweets.js, data/like.js, and data/direct-messages.js together.',
      ],
      tip: 'Official X archives wrap JSON inside `window.YTD.tweets.part0 = [...]` JavaScript files — the local parser strips that wrapper automatically.',
    },
  ],
  ru: [
    {
      id: 'antigravity',
      name: 'Antigravity 2.0',
      badgeColor: '#A855F7',
      expectedFiles: 'папка brain/ · transcript_full.jsonl · transcript.jsonl · .zip',
      steps: [
        'Нажмите «Выбрать папку» выше и укажите локальную папку brain (или перетащите её прямо на экран).',
        'Также можно перетащить отдельные файлы transcript_full.jsonl / transcript.jsonl или .zip-архив.',
        'Если в папке сессии есть оба файла, transcript_full.jsonl выбирается автоматически без дублей.',
      ],
      paths: [
        { label: 'Windows', value: '%USERPROFILE%\\.gemini\\antigravity\\brain' },
        { label: 'macOS / Linux', value: '~/.gemini/antigravity/brain' },
      ],
    },
    {
      id: 'claude_code',
      name: 'Claude Code CLI',
      badgeColor: '#C084FC',
      expectedFiles: 'папка ~/.claude/projects/ · <session-uuid>.jsonl · .zip',
      steps: [
        'Нажмите «Выбрать папку» и укажите ~/.claude/projects (или папку конкретного проекта).',
        'Либо выберите один или несколько .jsonl файлов сессий / .zip-бэкап.',
        'Повторяющиеся потоковые фрагменты с одинаковым message.id автоматически дедуплицируются для точного подсчёта токенов и KV-кэша.',
      ],
      paths: [
        { label: 'Windows', value: '%USERPROFILE%\\.claude\\projects' },
        { label: 'macOS / Linux', value: '~/.claude/projects' },
      ],
    },
    {
      id: 'telegram',
      name: 'Telegram',
      badgeColor: '#00FF9D',
      expectedFiles: 'result.json (отдельный чат или весь аккаунт) · .zip',
      steps: [
        'Откройте Telegram Desktop (мобильные клиенты не умеют выгружать JSON).',
        'Один чат: меню ⋮ → Export chat history. Весь аккаунт: Settings → Advanced → Export Telegram data.',
        'В пункте Format обязательно выберите "Machine-readable JSON" (медиа можно отключить, если нужен только текст и статистика).',
        'Перетащите result.json или .zip-архив прямо сюда.',
      ],
      tip: 'По умолчанию Telegram экспортирует в HTML — переключите формат на Machine-readable JSON.',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      badgeColor: '#22C55E',
      expectedFiles: '_chat.txt · Чат WhatsApp с ....txt · .zip',
      steps: [
        'Android: откройте чат → ⋮ → Ещё → Экспорт чата → Без файлов.',
        'iOS: откройте чат → нажмите на имя контакта/группы → Экспорт чата → Прикрепить без медиа.',
        'Перетащите .zip целиком (распаковывать не нужно) или текстовый .txt файл.',
      ],
      tip: 'Форматы iOS [DD.MM.YY, HH:MM:SS] и Android DD/MM/YYYY, HH:MM, а также порядок дат ДД/ММ vs ММ/ДД определяются автоматически.',
    },
    {
      id: 'discord',
      name: 'Discord',
      badgeColor: '#818CF8',
      expectedFiles: 'Data Package .zip · папка messages/ · DiscordChatExporter .json',
      steps: [
        'Официальный архив: Настройки пользователя → Конфиденциальность и безопасность → «Запросить все мои данные» → перетащите .zip или папку messages/.',
        'Названия каналов и ЛС автоматически подтянутся из messages/index.json.',
        'Если пользуетесь DiscordChatExporter: выберите формат JSON и перетащите файл канала.',
      ],
    },
    {
      id: 'chatgpt',
      name: 'OpenAI ChatGPT',
      badgeColor: '#38BDF8',
      expectedFiles: 'архив .zip от OpenAI · conversations.json',
      steps: [
        'Откройте chatgpt.com → Settings → Data controls → Export data → Confirm export.',
        'Скачайте .zip по ссылке из письма от OpenAI.',
        'Перетащите .zip прямо сюда (или распакованный conversations.json).',
      ],
    },
    {
      id: 'claude_ai',
      name: 'Claude.ai',
      badgeColor: '#FB923C',
      expectedFiles: 'архив .zip · conversations.json',
      steps: [
        'Откройте claude.ai → Settings → Account / Privacy → Export Data.',
        'Скачайте .zip архив из письма.',
        'Перетащите .zip сюда напрямую или conversations.json — поддерживаются и thinking-блоки, и код.',
      ],
    },
    {
      id: 'chrome_history',
      name: 'Google Chrome',
      badgeColor: '#F59E0B',
      expectedFiles: 'Google Takeout .zip · BrowserHistory.json / History.json',
      steps: [
        'Откройте takeout.google.com и нажмите «Отменить выбор» (Deselect all).',
        'Отметьте Chrome (история уже выгружается в JSON).',
        'Скачайте .zip и перетащите его прямо в окно — даже если в одном Takeout .zip лежат и Chrome, и YouTube, приложение даст выбрать нужный.',
      ],
    },
    {
      id: 'youtube',
      name: 'YouTube',
      badgeColor: '#F43F5E',
      expectedFiles: 'Google Takeout .zip · watch-history.json',
      steps: [
        'Откройте takeout.google.com → «Отменить выбор» → отметьте YouTube и YouTube Music.',
        'Нажмите «Несколько форматов» (Multiple formats) и переключите «Историю» с HTML на JSON ⚠️.',
        'Скачайте .zip и перетащите прямо сюда (или отдельно watch-history.json).',
      ],
      tip: 'Google Takeout по умолчанию отдаёт историю YouTube в HTML — обязательно выберите JSON в настройках форматов.',
    },
    {
      id: 'spotify',
      name: 'Spotify',
      badgeColor: '#10B981',
      expectedFiles: '.zip · Streaming_History_Audio_*.json · StreamingHistory*.json',
      steps: [
        'Откройте spotify.com/account/privacy в браузере.',
        'Запросите Extended streaming history (полная история за все годы со скипами, shuffle и платформами) либо Account data (за последний год).',
        'Перетащите .zip целиком или выделите сразу все файлы Streaming_History_Audio_*.json.',
      ],
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      badgeColor: '#EC4899',
      expectedFiles: '.zip · user_data_tiktok.json',
      steps: [
        'TikTok → Настройки и конфиденциальность → Аккаунт → Загрузить ваши данные.',
        'Переключите формат файла с TXT на JSON ⚠️ и нажмите «Запросить данные».',
        'Перетащите полученный .zip или файл user_data_tiktok.json сюда.',
      ],
      tip: 'Обязательно выберите формат JSON вместо TXT перед отправкой запроса в TikTok.',
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      badgeColor: '#38BDF8',
      expectedFiles: '.zip · data/tweets.js · data/like.js · data/direct-messages.js',
      steps: [
        'Откройте X (x.com) → Ещё → Настройки и конфиденциальность → Ваша учётная запись → Скачать архив ваших данных.',
        'Подтвердите пароль/код 2FA и нажмите «Запросить архив» (подготовка занимает около 24 часов).',
        'Перетащите полученный .zip целиком прямо сюда — либо выберите файлы data/tweets.js, data/like.js и data/direct-messages.js.',
      ],
      tip: 'В архиве X файлы начинаются с `window.YTD.tweets.part0 = [...]` — парсер сам отрезает JS-обёртку на лету прямо в браузере.',
    },
  ],
};
