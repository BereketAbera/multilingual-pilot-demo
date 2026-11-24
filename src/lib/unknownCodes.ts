// Backend codes this client had no text for, kept for the browser session so the
// Translation status page can list them.

const KEY = 'pilot.unknownCodes';

export interface UnknownCode {
  code: string;
  detail: string;
  seenAt: string;
}

export function readUnknownCodes(): UnknownCode[] {
  try {
    const raw = globalThis.sessionStorage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Storage can hold anything; keep only entries that are what this file writes.
    return parsed.filter(
      (entry): entry is UnknownCode =>
        typeof entry === 'object' && entry !== null && typeof (entry as UnknownCode).code === 'string' && typeof (entry as UnknownCode).detail === 'string',
    );
  } catch {
    return [];
  }
}

export function recordUnknownCode(code: string, detail: string): void {
  if (!code || !detail) return;
  try {
    const known = readUnknownCodes().filter((entry) => entry.code !== code);
    known.push({ code, detail, seenAt: new Date().toISOString() });
    globalThis.sessionStorage?.setItem(KEY, JSON.stringify(known));
  } catch {
    // Session storage can be blocked; the message is still shown to the user.
  }
}
