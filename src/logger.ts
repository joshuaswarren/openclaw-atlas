/**
 * Logger wrapper for Atlas plugin
 */

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

let prefix = "[atlas]";

export function setLoggerPrefix(p: string): void {
  prefix = p;
}

export const log: Logger = {
  debug(...args: unknown[]): void {
    console.debug(prefix, ...args);
  },
  info(...args: unknown[]): void {
    console.info(prefix, ...args);
  },
  warn(...args: unknown[]): void {
    console.warn(prefix, ...args);
  },
  error(...args: unknown[]): void {
    console.error(prefix, ...args);
  },
};
