import { config } from "../../package.json";

const logPrefix = `[${config.addonName}]`;

export function log(...args: any[]) {
  if (typeof Zotero !== "undefined" && Zotero.debug) {
    Zotero.debug(`${logPrefix} ${args.join(" ")}`);
  } else {
    console.log(logPrefix, ...args);
  }
}

export function error(...args: any[]) {
  if (typeof Zotero !== "undefined" && Zotero.logError) {
    Zotero.logError(new Error(`${logPrefix} ${args.join(" ")}`));
  } else {
    console.error(logPrefix, ...args);
  }
}

export function warn(...args: any[]) {
  if (typeof Zotero !== "undefined" && Zotero.debug) {
    Zotero.debug(`${logPrefix} [WARN] ${args.join(" ")}`);
  } else {
    console.warn(logPrefix, ...args);
  }
}
