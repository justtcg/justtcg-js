import { colors } from './colors';

// Compact logging mode: true (default) prints a single summary line per poll
export const COMPACT_LOGS = process.env.COMPACT_LOGS
  ? String(process.env.COMPACT_LOGS).toLowerCase() === 'true'
  : true;

export function nowISO() {
  return new Date().toISOString();
}

// Compact/Debug Logging Helpers — the example can import these and avoid
// having logging code directly in other scripts.
export function logDebug(msg: string) {
  if (!COMPACT_LOGS) console.log(`${colors.cyan}[DBG ${nowISO()}]${colors.reset} ${msg}`);
}

export function logCompact(msg: string) {
  if (COMPACT_LOGS) console.log(msg);
  else console.log(`${colors.cyan}[INFO ${nowISO()}]${colors.reset} ${msg}`);
}

export function logInfo(msg: string) {
  console.log(`${colors.cyan}[INFO ${nowISO()}]${colors.reset} ${msg}`);
}

export function logWarn(msg: string) {
  console.warn(`${colors.yellow}[WARN ${nowISO()}]${colors.reset} ${msg}`);
}

export function logError(msg: string) {
  console.error(`${colors.red}[ERR ${nowISO()}]${colors.reset} ${msg}`);
}

export default {
  nowISO,
  logDebug,
  logCompact,
  logInfo,
  logWarn,
  logError,
};
