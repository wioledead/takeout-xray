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
    browseFolderBtn: string;
    copyPath: string;
    copiedPath: string;
    openGuidesBtn: string;
    guidesModalTitle: string;
    guidesModalSubtitle: string;
    guidesExpectedLabel: string;
    guidesClickHint: string;
    zipInspecting: string;
    zipMultiTitle: string;
    zipMultiDesc: string;
    zipCancel: string;
    zipFilesUnit: string;
    supportedTitle: string;
    supportedAgents: string;
    supportedChats: string;
    supportedAiChats: string;
    supportedMedia: string;
    demoTitle: string;
    demoSubtitle: string;
    demoRunBadge: string;
    demoTgTitle: string;
    demoTgDesc: string;
    demoWaTitle: string;
    demoWaDesc: string;
    demoDiscordTitle: string;
    demoDiscordDesc: string;
    demoGptTitle: string;
    demoGptDesc: string;
    demoClaudeAiTitle: string;
    demoClaudeAiDesc: string;
    demoAgTitle: string;
    demoAgDesc: string;
    demoClaudeCodeTitle: string;
    demoClaudeCodeDesc: string;
    demoYtTitle: string;
    demoYtDesc: string;
    demoSpotifyTitle: string;
    demoSpotifyDesc: string;
    demoTiktokTitle: string;
    demoTiktokDesc: string;
    demoTwitterTitle: string;
    demoTwitterDesc: string;
    demoChromeTitle: string;
    demoChromeDesc: string;
    demoGuidesTitle: string;
    demoGuidesDesc: string;
    demoGuidesBadge: string;
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
    totalStreams: string;
    totalVideosWatched: string;
    totalPosts: string;
    activeDays: string;
    totalWords: string;
    uniqueDomains: string;
    mediaAttachments: string;
    threadsCount: string;
    dateSpan: string;
    serviceEvents: string;
    regeneratedBranches: string;
    agentSteps: string;
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
    channelsTitle: string;
    channelsDesc: string;
    channelCol: string;
    artistsTitle: string;
    artistsDesc: string;
    artistCol: string;
    domainsTitle: string;
    domainsDesc: string;
    domainCol: string;
    aiBalanceTitle: string;
    aiBalanceDesc: string;
    turnsCol: string;
    handlesTitle: string;
    handlesDesc: string;
    handleCol: string;
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
    turnaroundTitle: string;
    turnaroundDesc: string;
    followUpTitle: string;
    followUpDesc: string;
    agentToolsTitle: string;
    agentToolsDesc: string;
    mediaBingeTitle: string;
    mediaBingeDesc: string;
    mediaEngagementTitle: string;
    mediaEngagementDesc: string;
    spotifyArtistsTitle: string;
    spotifyArtistsDesc: string;
    spotifyHabitsTitle: string;
    spotifyHabitsDesc: string;
    browserTransitionsTitle: string;
    browserTransitionsDesc: string;
    browserRabbitHolesTitle: string;
    browserRabbitHolesDesc: string;
    twitterMixTitle: string;
    twitterMixDesc: string;
    twitterClientsTitle: string;
    twitterClientsDesc: string;
    circadianTitle: string;
    circadianDesc: string;
    nightOwlScore: string;
    nightOwlDesc: string;
    peakHour: string;
    noInitiatorData: string;
    noReplyData: string;
    noMonologueData: string;
    chromeBehaviorNote: string;
    mediaBehaviorNote: string;
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
    claudeAiLensTitle: string;
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
    agLensTitle: string;
    claudeCodeLensTitle: string;
    agLensDesc: string;
    agPromptTokens: string;
    agCacheRead: string;
    agOutputTokens: string;
    agCacheHit: string;
    agToolsExecuted: string;
    agThinkingVsReply: string;
    agCompactions: string;
    agTopTools: string;
    agCallsUnit: string;
    spotifyLensTitle: string;
    spotifyLensDesc: string;
    spotifyHours: string;
    spotifyPlays: string;
    spotifyUniqueArtists: string;
    spotifySkipRate: string;
    spotifyShuffleRate: string;
    spotifyTopArtists: string;
    spotifyTopTracks: string;
    spotifyMinsUnit: string;
    ytLensTitle: string;
    ytLensDesc: string;
    ytTotalVideos: string;
    ytUniqueChannels: string;
    ytShortsShare: string;
    ytTopChannels: string;
    ytBingeStreaks: string;
    ytVideosUnit: string;
    ytStreakUnit: string;
    ttLensTitle: string;
    ttLensDesc: string;
    ttWatchedVideos: string;
    ttLikes: string;
    ttSearches: string;
    ttLikeRate: string;
    ttUniqueCreators: string;
    ttTopCreators: string;
    ttBingeStreaks: string;
    twLensTitle: string;
    twLensDesc: string;
    twOriginalPosts: string;
    twReplies: string;
    twRetweets: string;
    twLikesGiven: string;
    twLikesReceived: string;
    twTopHandles: string;
    twTopSources: string;
    twTopViral: string;
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
    recommendedBadge: string;
    presets: {
      monologues: string;
      lateNight: string;
      domains: string;
      hourlyVolume: string;
      emojis: string;
      responseTimes: string;
      antigravityTools: string;
      antigravityTokens: string;
      spotifyArtists: string;
      youtubeChannels: string;
      twitterPosts: string;
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
    topArtists: string;
    topChannels: string;
    topCreators: string;
    gptPolite: string;
    agCacheTools: string;
    topArtist: string;
    listeningSummary: string;
    topChannel: string;
    ytFormats: string;
    topCreator: string;
    ttEngagement: string;
    topDomain: string;
    longestHole: string;
    aiCodeDensity: string;
    agCacheHit: string;
    agToolsCount: string;
    topHandle: string;
    twPostMix: string;
    topSources: string;
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
      claude_ai: 'CLAUDE.AI ARCHIVE',
      chrome_history: 'CHROME HISTORY',
      antigravity: 'ANTIGRAVITY 2.0',
      claude_code: 'CLAUDE CODE CLI',
      whatsapp: 'WHATSAPP CHAT',
      discord: 'DISCORD ARCHIVE',
      spotify: 'SPOTIFY HISTORY',
      youtube: 'YOUTUBE HISTORY',
      tiktok: 'TIKTOK EXPORT',
      twitter: 'X / TWITTER ARCHIVE',
    },
    tabs: {
      overview: 'Overview',
      behavior: 'Behavior & Dynamics',
      lexicon: 'Lexicon & Lenses',
      sql: 'SQL Console',
    },
    dropzone: {
      title: 'DROP ANY EXPORT (.ZIP / JSON / JS / JSONL / TXT) OR FOLDER',
      subtitle:
        'Stream-parsed locally in Web Worker + DuckDB-Wasm. Handles 12 platforms (13 export formats) including raw .zip archives, AI agents, messengers, social & media history without uploading a byte.',
      dropActive: 'RELEASE TO INITIATE LOCAL X-RAY SCAN',
      browseBtn: 'Select Files / .ZIP',
      browseFolderBtn: 'Select Folder (Brain / Discord / Claude)',
      copyPath: 'Copy path',
      copiedPath: 'Copied!',
      openGuidesBtn: 'Where to get exports? · 12 Service Guides',
      guidesModalTitle: 'EXPORT GUIDES · HOW TO EXTRACT YOUR DATA',
      guidesModalSubtitle:
        'Step-by-step instructions and local folder paths for every supported platform',
      guidesExpectedLabel: 'Expected files',
      guidesClickHint: 'Click any service for step-by-step export instructions:',
      zipInspecting: 'Scanning .ZIP central directory locally...',
      zipMultiTitle: 'MULTI-SERVICE .ZIP DETECTED',
      zipMultiDesc: 'Multiple datasets found inside archive — select which export to dissect first:',
      zipCancel: 'Cancel',
      zipFilesUnit: 'files',
      supportedTitle: '12 SUPPORTED PLATFORMS (13 FORMATS · .ZIP AUTO-EXTRACTED)',
      supportedAgents:
        'AI Agents: Antigravity 2.0 (brain/ folder or transcript_full.jsonl) & Claude Code CLI (~/.claude/projects/**/*.jsonl)',
      supportedChats:
        'Messengers: Telegram (result.json), WhatsApp (_chat.txt iOS/Android) & Discord (Data Package messages/ or DiscordChatExporter)',
      supportedAiChats:
        'AI Chats: OpenAI ChatGPT (conversations.json DAG) & Anthropic Claude.ai (conversations.json)',
      supportedMedia:
        'Web, Social & Media: X / Twitter (tweets.js / like.js), Chrome, YouTube, Spotify & TikTok',
      demoTitle: 'INSTANT CLIENT-SIDE DEMOS · ALL 12 PLATFORMS (SYNTHETIC DATA)',
      demoSubtitle:
        'Not sure what works? Pick any platform below to inspect a live synthetic report and see what file format to drop.',
      demoRunBadge: 'DEMO →',
      demoTgTitle: 'Telegram (Chat / Account)',
      demoTgDesc: '~15,000 messages across 3 chats & reply cadence',
      demoWaTitle: 'WhatsApp',
      demoWaDesc: '1,400 chat messages, media markers & links',
      demoDiscordTitle: 'Discord',
      demoDiscordDesc: '1,500 server channels & DM messages',
      demoGptTitle: 'OpenAI ChatGPT',
      demoGptDesc: '300 conversations with regenerated DAG branches',
      demoClaudeAiTitle: 'Anthropic Claude.ai',
      demoClaudeAiDesc: '96 AI chats, prompt politeness & code blocks',
      demoAgTitle: 'Antigravity 2.0',
      demoAgDesc: '4 agent sessions with KV cache & tool calls',
      demoClaudeCodeTitle: 'Claude Code CLI',
      demoClaudeCodeDesc: '4 terminal coding sessions, tokens & Read/Edit/Bash',
      demoYtTitle: 'YouTube',
      demoYtDesc: '960 watches, Shorts ratio & channel streaks',
      demoSpotifyTitle: 'Spotify',
      demoSpotifyDesc: '1,400 streams, skip rates & artist obsession',
      demoTiktokTitle: 'TikTok',
      demoTiktokDesc: 'Feed watches, likes, searches & @creator streaks',
      demoTwitterTitle: 'X (Twitter)',
      demoTwitterDesc: 'Tweets, replies, retweets, likes & @handles',
      demoChromeTitle: 'Google Chrome',
      demoChromeDesc: '~10,000 browser visits & domain rabbit holes',
      demoGuidesTitle: 'Where to download your archive?',
      demoGuidesDesc: 'Step-by-step instructions & paths for all 12 supported formats',
      demoGuidesBadge: 'GUIDES →',
      privacyTitle: 'ZERO-EXFILTRATION GUARANTEE',
      privacyDesc:
        'No backend. No cloud upload. Even .zip decompression runs 100% in-browser via streaming central-directory slicing straight into DuckDB-Wasm.',
      phaseDetecting: 'SNIFFING EXPORT SIGNATURE...',
      phaseStreaming: 'STREAMING & BATCHING INTO DUCKDB...',
      phaseIndexing: 'COMPUTING FORENSIC TELEMETRY...',
      phaseReady: 'ANALYSIS COMPLETE',
      rowsProcessed: 'ROWS INGESTED',
      throughput: 'THROUGHPUT',
      threadsFound: 'THREADS',
      errorPrefix: 'INGESTION FAILED',
      unsupportedFormat:
        'Unrecognized archive format. Drop a .zip/.json/.js/.jsonl/.txt export from Antigravity, Claude Code, Telegram, WhatsApp, Discord, ChatGPT, Claude.ai, X (Twitter), Chrome, YouTube, Spotify, or TikTok.',
    },
    overview: {
      totalEvents: 'Total Events',
      totalVisits: 'Total Visits',
      totalStreams: 'Total Streams',
      totalVideosWatched: 'Videos Watched',
      totalPosts: 'Posts & Likes',
      activeDays: 'Active Days',
      totalWords: 'Total Words',
      uniqueDomains: 'Media / Domains',
      mediaAttachments: 'Media & Files',
      threadsCount: 'Threads / Chats',
      dateSpan: 'Time Horizon',
      serviceEvents: 'Service Events',
      regeneratedBranches: 'Regenerated / Extra Blocks',
      agentSteps: 'Tool & Sys Steps',
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
      channelsTitle: 'Top Channels / @Creators',
      channelsDesc: 'Highest watch share across observed creators & channels',
      channelCol: 'Channel / @Creator',
      artistsTitle: 'Most Streamed Artists',
      artistsDesc: 'Top artists by total stream events & listening share',
      artistCol: 'Artist',
      domainsTitle: 'Top Visited Domains',
      domainsDesc: 'Most frequently accessed websites & hosts',
      domainCol: 'Domain',
      aiBalanceTitle: 'User vs AI Turn Balance',
      aiBalanceDesc: 'Prompt & reply volume comparison',
      turnsCol: 'Turns',
      handlesTitle: 'Top Mentioned & Replied @Handles',
      handlesDesc: 'Accounts you replied to, retweeted, or mentioned most',
      handleCol: '@Handle',
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
      turnaroundTitle: 'Turn Pacing & Generation Speed',
      turnaroundDesc: 'Median delay between user prompt and model reply (excludes >6h breaks)',
      followUpTitle: 'Consecutive Prompt Streaks',
      followUpDesc: 'Multi-turn follow-ups vs alternating responses',
      agentToolsTitle: 'Most Invoked Agent Tools',
      agentToolsDesc: 'Distribution of shell, file read/edit, search & subagent calls',
      mediaBingeTitle: 'Channel / Creator Binge Marathons',
      mediaBingeDesc: 'Longest uninterrupted multi-video streaks on a single channel or creator',
      mediaEngagementTitle: 'Format & Feed Engagement Mix',
      mediaEngagementDesc: 'Short-form vs standard viewing and interactive actions ratio',
      spotifyArtistsTitle: 'Artist Obsession Concentration',
      spotifyArtistsDesc: 'Listening share across your most-replayed artists',
      spotifyHabitsTitle: 'Playback Discipline (Skip vs Shuffle)',
      spotifyHabitsDesc: 'Skipped tracks, shuffle toggle rate, total hours & unique catalog',
      browserTransitionsTitle: 'Navigation Entry Transitions',
      browserTransitionsDesc: 'How browsing sessions started (clicked links, typed URLs, reloads)',
      browserRabbitHolesTitle: 'Consecutive Domain Rabbit Holes',
      browserRabbitHolesDesc: 'Deepest unbroken visit streaks on a single website',
      twitterMixTitle: 'Posting Style Breakdown (Tweets vs Replies vs RT)',
      twitterMixDesc: 'Ratio of original threads, replies, retweets & likes archived',
      twitterClientsTitle: 'Publishing Clients & Apps',
      twitterClientsDesc: 'Devices and apps used when posting on X / Twitter',
      circadianTitle: 'Hourly Activity Distribution',
      circadianDesc: '24-hour fingerprint in your local timezone',
      nightOwlScore: 'Night Owl Index (00:00–05:00)',
      nightOwlDesc: 'Share of total events logged after midnight',
      peakHour: 'Peak Hour',
      noInitiatorData: 'No conversation session starts recorded in this selection.',
      noReplyData: 'Need at least 2 alternating participants within 6h windows to measure reply latency.',
      noMonologueData: 'Monologue streaks apply to message threads with dialogue turns.',
      chromeBehaviorNote:
        'Chrome browsing mode tracks session openings (6h+ idle gaps) and domain streaks across devices.',
      mediaBehaviorNote:
        'Media consumption mode tracks session openings after 6+ hour breaks and creator listening/watch cadence.',
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
      claudeAiLensTitle: 'Claude.ai Prompt Forensics Lens',
      gptLensDesc: 'Inspect human-vs-model footprint, politeness, code density & extra/thinking turns',
      gptUserVsAssistant: 'User vs Assistant Chars',
      gptPoliteness: 'Polite Prompts (please/thanks)',
      gptCodeDensity: 'Messages with Code Blocks',
      gptRegenBranches: 'Branches / Thinking Turns',
      gptPeakHour: 'Peak Prompting Hour',
      chromeLensTitle: 'Chrome Navigation Forensics Lens',
      chromeLensDesc: 'Top domains, navigation transitions & single-domain rabbit holes',
      chromeTopDomains: 'Top Visited Domains',
      chromeTransitions: 'Page Transition Types',
      chromeRabbitHoles: 'Longest Domain Rabbit Holes',
      visits: 'visits',
      streak: 'consecutive visits',
      agLensTitle: 'Antigravity 2.0 Agent Telemetry Lens',
      claudeCodeLensTitle: 'Claude Code CLI Agent Telemetry Lens',
      agLensDesc: 'Token budget, KV prompt cache efficiency, internal thinking vs replies & tool calls',
      agPromptTokens: 'Input Tokens (Uncached)',
      agCacheRead: 'Cache Read Tokens',
      agOutputTokens: 'Output Tokens',
      agCacheHit: 'KV Cache Hit Rate',
      agToolsExecuted: 'Total Tool Calls',
      agThinkingVsReply: 'Thinking / Reply Chars',
      agCompactions: 'Compactions / Errors',
      agTopTools: 'Most Frequent Tool Calls',
      agCallsUnit: 'calls',
      spotifyLensTitle: 'Spotify Audio Forensics Lens',
      spotifyLensDesc: 'Listening hours, skip/shuffle habits & top obsessed artists and tracks',
      spotifyHours: 'Hours Streamed',
      spotifyPlays: 'Track Plays',
      spotifyUniqueArtists: 'Unique Artists / Tracks',
      spotifySkipRate: 'Skip Rate',
      spotifyShuffleRate: 'Shuffle Rate',
      spotifyTopArtists: 'Top Artists by Listening Time',
      spotifyTopTracks: 'Most Replayed Tracks',
      spotifyMinsUnit: 'min',
      ytLensTitle: 'YouTube Watch Forensics Lens',
      ytLensDesc: 'Channel concentration, Shorts ratio & consecutive watch marathons',
      ytTotalVideos: 'Videos Watched',
      ytUniqueChannels: 'Unique Channels',
      ytShortsShare: 'Shorts Share',
      ytTopChannels: 'Top Watched Channels',
      ytBingeStreaks: 'Longest Channel Binge Streaks',
      ytVideosUnit: 'videos',
      ytStreakUnit: 'in a row',
      ttLensTitle: 'TikTok Feed & Dopamine Lens',
      ttLensDesc: 'Watched feed volume, like-to-watch ratio, search habits & creator streaks',
      ttWatchedVideos: 'Watched Videos',
      ttLikes: 'Liked Videos',
      ttSearches: 'Search Queries',
      ttLikeRate: 'Like / Watch Ratio',
      ttUniqueCreators: 'Identified @Creators',
      ttTopCreators: 'Top @Creators',
      ttBingeStreaks: 'Creator Feed Streaks',
      twLensTitle: 'X / Twitter Social Forensics Lens',
      twLensDesc: 'Posts, replies, retweets, Snowflake-dated likes, clients & top viral tweets',
      twOriginalPosts: 'Original Posts',
      twReplies: 'Replies',
      twRetweets: 'Retweets Sent',
      twLikesGiven: 'Likes Given',
      twLikesReceived: 'Likes Received ❤️',
      twTopHandles: 'Most Engaged @Handles',
      twTopSources: 'Posting Clients',
      twTopViral: 'Top Performing Posts by Likes',
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
      recommendedBadge: 'FOR THIS SOURCE',
      presets: {
        monologues: 'Top 10 Longest Monologues',
        lateNight: 'Late Night Activity (00:00–05:00)',
        domains: 'Most Shared / Visited Domains',
        hourlyVolume: 'Hourly Volume & Words',
        emojis: 'Emoji Leaderboard',
        responseTimes: 'Median Reply Latency SQL',
        antigravityTools: 'Agent Top Tools (Antigravity / Claude Code)',
        antigravityTokens: 'Agent Tokens & KV Cache by Session',
        spotifyArtists: 'Spotify Top Artists & Hours',
        youtubeChannels: 'YouTube / TikTok Top Channels',
        twitterPosts: 'X / Twitter Viral Posts & Clients',
      },
    },
    networkModal: {
      title: 'LIVE NETWORK TELEMETRY AUDIT',
      subtitle: 'Monitored continuously via PerformanceObserver + fetch/XHR/sendBeacon wrappers',
      statusClean: 'ZERO DATA EXFILTRATION VERIFIED — 0 BYTES SENT',
      statusAlert: 'OUTGOING PAYLOAD DETECTED',
      bytesSent: 'Bytes Sent After Init',
      externalRequests: 'External Requests',
      observedCount: 'Logged Events',
      colTime: 'Time',
      colKind: 'Type',
      colUrl: 'Target',
      colBytes: 'Bytes Out',
      emptyLog: 'No outgoing network activity recorded after engine initialization.',
      close: 'Close',
    },
    shareModal: {
      title: 'X-Ray Wrapped Card Generator',
      subtitle: 'Renders a 1080×1350 terminal poster locally in PNG without leaving your browser',
      anonymize: 'Anonymize Data',
      downloadPng: 'Download PNG',
      exporting: 'Rendering PNG...',
      exportFailed: 'Failed to export PNG in current browser context.',
      close: 'Close',
      cardHeader: 'PERSONAL DATA FORENSICS // WRAPPED',
      cardFooter: '100% LOCAL · DUCKDB-WASM · 0 BYTES EXFILTRATED',
      topInitiator: 'Top Initiator',
      replySpeed: 'Median Reply',
      nightOwl: 'Night Owl Index',
      peakHour: 'Peak Hour',
      topWords: 'Top Vocabulary',
      topEmojis: 'Top Emojis',
      topDomains: 'Top Domains',
      topArtists: 'Top Artists',
      topChannels: 'Top Channels',
      topCreators: 'Top Creators',
      gptPolite: 'Polite Prompts',
      agCacheTools: 'KV Cache / Tools',
      topArtist: 'Top Artist',
      listeningSummary: 'Audio Time / Skip',
      topChannel: 'Top Channel',
      ytFormats: 'Channels / Shorts',
      topCreator: 'Top @Creator',
      ttEngagement: 'Likes / Searches',
      topDomain: 'Top Domain',
      longestHole: 'Deepest Dive',
      aiCodeDensity: 'Code Prompts',
      agCacheHit: 'KV Cache Hit',
      agToolsCount: 'Tools Executed',
      topHandle: 'Top @Handle',
      twPostMix: 'Post / Reply / RT',
      topSources: 'Top Clients',
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
      claude_ai: 'АРХИВ CLAUDE.AI',
      chrome_history: 'ИСТОРИЯ CHROME',
      antigravity: 'ANTIGRAVITY 2.0',
      claude_code: 'CLAUDE CODE CLI',
      whatsapp: 'ЧАТ WHATSAPP',
      discord: 'АРХИВ DISCORD',
      spotify: 'ИСТОРИЯ SPOTIFY',
      youtube: 'ИСТОРИЯ YOUTUBE',
      tiktok: 'ЭКСПОРТ TIKTOK',
      twitter: 'АРХИВ X / TWITTER',
    },
    tabs: {
      overview: 'Обзор',
      behavior: 'Поведение и ритм',
      lexicon: 'Лексикон и линзы',
      sql: 'SQL Консоль',
    },
    dropzone: {
      title: 'ПЕРЕТАЩИТЕ ЭКСПОРТ (.ZIP / JSON / JS / JSONL / TXT) ИЛИ ПАПКУ',
      subtitle:
        'Потоковый парсинг в Web Worker + DuckDB-Wasm. 12 сервисов (13 форматов выгрузки): сырые .zip-архивы, ИИ-агенты, мессенджеры, соцсети и медиа — без единого байта в сеть.',
      dropActive: 'ОТПУСТИТЕ ФАЙЛ, .ZIP ИЛИ ПАПКУ ДЛЯ СКАНИРОВАНИЯ',
      browseBtn: 'Выбрать файлы / .ZIP',
      browseFolderBtn: 'Выбрать папку (brain / Discord / Claude)',
      copyPath: 'Копировать путь',
      copiedPath: 'Скопировано!',
      openGuidesBtn: 'Откуда брать выгрузки? · Гайды по 12 сервисам',
      guidesModalTitle: 'ГАЙДЫ ПО ЭКСПОРТУ · КАК ПОЛУЧИТЬ АРХИВЫ',
      guidesModalSubtitle:
        'Пошаговые инструкции и локальные пути папок для каждого поддерживаемого сервиса',
      guidesExpectedLabel: 'Ожидаемые файлы',
      guidesClickHint: 'Нажмите на сервис для пошаговой инструкции:',
      zipInspecting: 'Чтение оглавления .ZIP архива локально...',
      zipMultiTitle: 'В .ZIP ОБНАРУЖЕНО НЕСКОЛЬКО СЕРВИСОВ',
      zipMultiDesc: 'В архиве сразу несколько выгрузок — выберите, что разобрать первым:',
      zipCancel: 'Отмена',
      zipFilesUnit: 'файл.',
      supportedTitle: '12 ПОДДЕРЖИВАЕМЫХ СЕРВИСОВ (13 ФОРМАТОВ · .ZIP АВТО)',
      supportedAgents:
        'ИИ-агенты: Antigravity 2.0 (папка brain/ или transcript_full.jsonl) и Claude Code CLI (~/.claude/projects/**/*.jsonl)',
      supportedChats:
        'Мессенджеры: Telegram (result.json), WhatsApp (_chat.txt iOS/Android) и Discord (Data Package messages/ или DiscordChatExporter)',
      supportedAiChats:
        'ИИ-чаты: OpenAI ChatGPT (conversations.json DAG) и Anthropic Claude.ai (conversations.json)',
      supportedMedia:
        'Веб, соцсети и медиа: X / Twitter (tweets.js / like.js), Chrome, YouTube, Spotify и TikTok',
      demoTitle: 'МГНОВЕННЫЕ ДЕМО · ВСЕ 12 СЕРВИСОВ (СИНТЕТИКА)',
      demoSubtitle:
        'Неясно, что сюда можно закинуть? Нажмите на любой сервис — запустится демо-отчёт и виден нужный формат файла.',
      demoRunBadge: 'ДЕМО →',
      demoTgTitle: 'Telegram (чат / аккаунт)',
      demoTgDesc: '~15 000 сообщений в 3 чатах и скорость ответов',
      demoWaTitle: 'WhatsApp',
      demoWaDesc: '1 400 сообщений, пропуски медиа и ссылки',
      demoDiscordTitle: 'Discord',
      demoDiscordDesc: '1 500 сообщений из каналов сервера и ЛС',
      demoGptTitle: 'OpenAI ChatGPT',
      demoGptDesc: '300 диалогов с ветками перегенерации',
      demoClaudeAiTitle: 'Anthropic Claude.ai',
      demoClaudeAiDesc: '96 диалогов, вежливость промптов и код',
      demoAgTitle: 'Antigravity 2.0',
      demoAgDesc: '4 сессии агента с KV-кэшем и вызовами тулзов',
      demoClaudeCodeTitle: 'Claude Code CLI',
      demoClaudeCodeDesc: '4 терминальные сессии, токены и Read/Edit/Bash',
      demoYtTitle: 'YouTube',
      demoYtDesc: '960 видео, доля Shorts и марафоны каналов',
      demoSpotifyTitle: 'Spotify',
      demoSpotifyDesc: '1 400 прослушиваний, скипы и топ-артисты',
      demoTiktokTitle: 'TikTok',
      demoTiktokDesc: 'Лента просмотров, лайки, поиск и серии @авторов',
      demoTwitterTitle: 'X (Twitter)',
      demoTwitterDesc: 'Твиты, реплаи, ретвиты, лайки и @аккаунты',
      demoChromeTitle: 'Google Chrome',
      demoChromeDesc: '~10 000 визитов и «кроличьих нор» доменов',
      demoGuidesTitle: 'Где скачать свои архивы?',
      demoGuidesDesc: 'Пошаговые инструкции и пути для всех 12 форматов выгрузки',
      demoGuidesBadge: 'ГАЙДЫ →',
      privacyTitle: 'ГАРАНТИЯ НУЛЕВОЙ ОТПРАВКИ',
      privacyDesc:
        'Без бэкенда и облака. Даже распаковка .zip работает потоково прямо в браузере и пишет батчи напрямую в DuckDB-Wasm.',
      phaseDetecting: 'ОПРЕДЕЛЕНИЕ СИГНАТУРЫ ФАЙЛА...',
      phaseStreaming: 'ПОТОКОВЫЙ ПАРСИНГ И ЗАГРУЗКА В DUCKDB...',
      phaseIndexing: 'РАСЧЁТ МЕТРИК...',
      phaseReady: 'АНАЛИЗ ЗАВЕРШЁН',
      rowsProcessed: 'СТРОК ЗАГРУЖЕНО',
      throughput: 'СКОРОСТЬ',
      threadsFound: 'ДИАЛОГОВ',
      errorPrefix: 'ОШИБКА ИМПОРТА',
      unsupportedFormat:
        'Неизвестная структура экспорта. Поддерживаются .zip/.json/.js/.jsonl/.txt из Antigravity, Claude Code, Telegram, WhatsApp, Discord, ChatGPT, Claude.ai, X (Twitter), Chrome, YouTube, Spotify и TikTok.',
    },
    overview: {
      totalEvents: 'Всего событий',
      totalVisits: 'Всего визитов',
      totalStreams: 'Прослушиваний',
      totalVideosWatched: 'Просмотров видео',
      totalPosts: 'Посты и лайки',
      activeDays: 'Активных дней',
      totalWords: 'Всего слов',
      uniqueDomains: 'Медиа / домены',
      mediaAttachments: 'Медиа и файлы',
      threadsCount: 'Чаты / треды',
      dateSpan: 'Период',
      serviceEvents: 'Системные события',
      regeneratedBranches: 'Ветки / Thinking',
      agentSteps: 'Шаги агента и тулзы',
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
      channelsTitle: 'Топ каналов / @авторов',
      channelsDesc: 'Лидеры просмотров и доля внимания по каналам',
      channelCol: 'Канал / @автор',
      artistsTitle: 'Главные артисты',
      artistsDesc: 'Частота прослушиваний и доля среди всех стримов',
      artistCol: 'Артист',
      domainsTitle: 'Топ посещаемых доменов',
      domainsDesc: 'Самые посещаемые сайты и хосты',
      domainCol: 'Домен',
      aiBalanceTitle: 'Баланс: Пользователь и ИИ',
      aiBalanceDesc: 'Сравнение объёма ваших запросов и ответов модели',
      turnsCol: 'Реплики',
      handlesTitle: 'Топ @аккаунтов и упоминаний',
      handlesDesc: 'С кем вы чаще всего переписывались в реплаях и кого ретвитили',
      handleCol: '@Аккаунт',
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
      turnaroundTitle: 'Тайминг диалога с ИИ',
      turnaroundDesc: 'Медианная пауза ответа модели против времени на ваш следующий промпт',
      followUpTitle: 'Серии уточнений подряд',
      followUpDesc: 'Сколько промптов подряд отправляется до смены хода',
      agentToolsTitle: 'Топ вызываемых тулзов',
      agentToolsDesc: 'Распределение вызовов терминала, чтения/правки файлов и поиска',
      mediaBingeTitle: 'Марафоны просмотра подряд',
      mediaBingeDesc: 'Самые длинные серии видео подряд на одном канале или @авторе',
      mediaEngagementTitle: 'Форматы и вовлечённость',
      mediaEngagementDesc: 'Соотношение коротких клипов, обычных видео и лайков/поиска',
      spotifyArtistsTitle: 'Концентрация на любимых артистах',
      spotifyArtistsDesc: 'Распределение часов и треков по главным исполнителям',
      spotifyHabitsTitle: 'Привычки плеера (Skip / Shuffle)',
      spotifyHabitsDesc: 'Процент пропусков, режим перемешивания, общее время и уникальные треки',
      browserTransitionsTitle: 'Способы переходов на сайты',
      browserTransitionsDesc: 'Клик по ссылке, прямой ввод URL в строку, перезагрузка и др.',
      browserRabbitHolesTitle: 'Самые глубокие «кроличьи норы»',
      browserRabbitHolesDesc: 'Длинные серии переходов подряд внутри одного домена',
      twitterMixTitle: 'Структура активности (Твиты / Реплаи / Ретвиты)',
      twitterMixDesc: 'Баланс авторских постов, ответов в тредах, ретвитов и лайков',
      twitterClientsTitle: 'Клиенты и устройства постинга',
      twitterClientsDesc: 'С каких приложений и устройств публиковались посты в X',
      circadianTitle: 'Суточный профиль активности',
      circadianDesc: 'Распределение по часам в локальном часовом поясе',
      nightOwlScore: 'Индекс «Совы» (00:00–05:00)',
      nightOwlDesc: 'Доля активности после полуночи',
      peakHour: 'Пиковый час',
      noInitiatorData: 'В выбранном срезе нет зафиксированных стартов сессий.',
      noReplyData: 'Для расчёта скорости ответа нужно минимум 2 собеседника с окном ответа < 6 ч.',
      noMonologueData: 'Серии монологов рассчитываются для диалогов и чатов с сообщениями.',
      chromeBehaviorNote:
        'Для истории браузера фиксируются старты новых сессий (после 6+ ч паузы) и суточный ритм.',
      mediaBehaviorNote:
        'В медиа-режиме учитываются старты сессий после 6-часовых пауз и ритм переключения авторов.',
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
      claudeAiLensTitle: 'Спец-аналитика Claude.ai',
      gptLensDesc: 'Соотношение текста, вежливость промптов, доля кода и дополнительные/thinking шаги',
      gptUserVsAssistant: 'Символы: Пользователь / ИИ',
      gptPoliteness: 'Вежливые промпты (please/спасибо)',
      gptCodeDensity: 'Сообщения с блоками кода',
      gptRegenBranches: 'Ветки / Thinking шаги',
      gptPeakHour: 'Пиковый час промптов',
      chromeLensTitle: 'Спец-аналитика Chrome',
      chromeLensDesc: 'Топ доменов, типы переходов и самые длинные серии визитов на один сайт',
      chromeTopDomains: 'Топ посещаемых доменов',
      chromeTransitions: 'Типы переходов (Transitions)',
      chromeRabbitHoles: 'Самые глубокие «кроличьи норы»',
      visits: 'визитов',
      streak: 'визитов подряд',
      agLensTitle: 'Телеметрия агента Antigravity 2.0',
      claudeCodeLensTitle: 'Телеметрия агента Claude Code CLI',
      agLensDesc: 'Бюджет токенов, попадание в KV-кэш, внутренний thinking против ответов и карта инструментов',
      agPromptTokens: 'Входные токены (новые)',
      agCacheRead: 'Чтение из KV-кэша',
      agOutputTokens: 'Выходные токены',
      agCacheHit: 'Попадание в KV-кэш',
      agToolsExecuted: 'Вызовов инструментов',
      agThinkingVsReply: 'Символы: Thinking / Ответы',
      agCompactions: 'Сжатий контекста / Ошибок',
      agTopTools: 'Топ вызываемых инструментов',
      agCallsUnit: 'выз.',
      spotifyLensTitle: 'Спец-аналитика Spotify Audio',
      spotifyLensDesc: 'Часы прослушивания, привычки skip/shuffle и главные артисты с треками',
      spotifyHours: 'Часов прослушано',
      spotifyPlays: 'Всего треков',
      spotifyUniqueArtists: 'Артистов / Треков',
      spotifySkipRate: 'Доля скипов (Skip)',
      spotifyShuffleRate: 'Режим Shuffle',
      spotifyTopArtists: 'Топ артистов по времени',
      spotifyTopTracks: 'Главные треки на повторе',
      spotifyMinsUnit: 'мин',
      ytLensTitle: 'Спец-аналитика YouTube Watch',
      ytLensDesc: 'Концентрация по каналам, доля Shorts и самые длинные марафоны подряд',
      ytTotalVideos: 'Видео просмотрено',
      ytUniqueChannels: 'Уникальных каналов',
      ytShortsShare: 'Доля Shorts',
      ytTopChannels: 'Топ каналов по просмотрам',
      ytBingeStreaks: 'Марафоны на одном канале',
      ytVideosUnit: 'видео',
      ytStreakUnit: 'подряд',
      ttLensTitle: 'Спец-аналитика TikTok Ленты',
      ttLensDesc: 'Просмотры, конверсия в лайки, поисковые запросы и залипания на @авторах',
      ttWatchedVideos: 'Просмотрено видео',
      ttLikes: 'Лайков',
      ttSearches: 'Поисковых запросов',
      ttLikeRate: 'Конверсия в лайк',
      ttUniqueCreators: 'Замечено @авторов',
      ttTopCreators: 'Топ @авторов',
      ttBingeStreaks: 'Серии на одном авторе',
      twLensTitle: 'Спец-аналитика X / Twitter',
      twLensDesc: 'Посты, реплаи, ретвиты, лайки с датами Snowflake, клиенты и главные виральные твиты',
      twOriginalPosts: 'Авторских постов',
      twReplies: 'Ответов (Replies)',
      twRetweets: 'Ретвитов (RT)',
      twLikesGiven: 'Лайков поставлено',
      twLikesReceived: 'Лайков получено ❤️',
      twTopHandles: 'Главные @аккаунты (реплаи / RT)',
      twTopSources: 'Клиенты постинга',
      twTopViral: 'Топ виральных постов по лайкам',
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
      recommendedBadge: 'РЕКОМЕНДУЕТСЯ',
      presets: {
        monologues: 'Топ-10 длинных монологов',
        lateNight: 'Ночная активность (00:00–05:00)',
        domains: 'Самые частые домены',
        hourlyVolume: 'Объём и слова по часам',
        emojis: 'Лидерборд эмодзи',
        responseTimes: 'Медианное время ответа',
        antigravityTools: 'Топ тулзов агентов (Antigravity / Claude)',
        antigravityTokens: 'Токены и KV-кэш агентов по сессиям',
        spotifyArtists: 'Топ артистов и часов Spotify',
        youtubeChannels: 'Топ каналов YouTube / TikTok',
        twitterPosts: 'X / Twitter виральные твиты и клиенты',
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
      anonymize: 'Анонимизировать данные',
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
      topArtists: 'Топ-артисты',
      topChannels: 'Топ-каналы',
      topCreators: 'Топ-авторы',
      gptPolite: 'Вежливые промпты',
      agCacheTools: 'KV-кэш / Тулзы',
      topArtist: 'Топ-артист',
      listeningSummary: 'Часы / Скипы',
      topChannel: 'Топ-канал',
      ytFormats: 'Каналы / Shorts',
      topCreator: 'Топ-@автор',
      ttEngagement: 'Лайки / Поиск',
      topDomain: 'Топ-домен',
      longestHole: 'Длинная серия',
      aiCodeDensity: 'Доля с кодом',
      agCacheHit: 'Попадание в кэш',
      agToolsCount: 'Вызовов тулзов',
      topHandle: 'Топ @аккаунт',
      twPostMix: 'Пост / Реплай / RT',
      topSources: 'Топ клиенты',
    },
  },
};
