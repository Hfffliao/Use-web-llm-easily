// logger.js
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// 默认等级（可根据环境或存储动态设置）
let currentLevel = LogLevel.DEBUG;  // 开发时设为 DEBUG，发布前改为 INFO 或 WARN

const logger = {
  debug(...args) {
    if (currentLevel <= LogLevel.DEBUG) console.debug('[DEBUG]', ...args);
  },
  info(...args) {
    if (currentLevel <= LogLevel.INFO) console.info('[INFO]', ...args);
  },
  warn(...args) {
    if (currentLevel <= LogLevel.WARN) console.warn('[WARN]', ...args);
  },
  error(...args) {
    if (currentLevel <= LogLevel.ERROR) console.error('[ERROR]', ...args);
  },
  setLevel(level) {
    currentLevel = LogLevel[level.toUpperCase()];
    // 持久化存储，方便下次使用
    chrome.storage.local.set({ logLevel: level.toUpperCase() });
  }
};

export default logger;