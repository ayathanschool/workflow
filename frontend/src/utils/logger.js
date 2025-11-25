// Lightweight frontend logger with level gating
// Configure via Vite env: VITE_LOG_LEVEL = 'error' | 'warn' | 'info' | 'debug'
// Also enable debug at runtime by setting sessionStorage.DEBUG_LOGS = '1'

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function currentLevel() {
  const forced = typeof window !== 'undefined' && window.sessionStorage && window.sessionStorage.getItem('DEBUG_LOGS');
  if (forced) return LEVELS.debug;
  const envLevel = (import.meta.env.VITE_LOG_LEVEL || (import.meta.env.PROD ? 'warn' : 'debug')).toLowerCase();
  return LEVELS[envLevel] ?? LEVELS.warn;
}

let levelCache = currentLevel();

export function setLevel(lvl) {
  levelCache = LEVELS[lvl] ?? levelCache;
}

function emit(minLevel, fn, args) {
  if (levelCache >= minLevel) {
    // eslint-disable-next-line no-console
    fn.apply(console, args);
  }
}

export const log = (...args) => emit(LEVELS.info, console.log, args);
export const info = (...args) => emit(LEVELS.info, console.info, args);
export const warn = (...args) => emit(LEVELS.warn, console.warn, args);
export const error = (...args) => emit(LEVELS.error, console.error, args);
export const debug = (...args) => emit(LEVELS.debug, console.debug, args);

export default { log, info, warn, error, debug, setLevel };
