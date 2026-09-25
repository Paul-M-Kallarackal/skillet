/** Per-viewer UI flags. Storage can be missing or throw (private windows), so every access is guarded. */
export function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    if (value === null) {
      return fallback;
    }
    return value === '1';
  } catch {
    return fallback;
  }
}

export function writeFlag(key: string, value: boolean): void {
  try {
    let stored = '0';
    if (value) {
      stored = '1';
    }
    window.localStorage.setItem(key, stored);
  } catch {
    // Preference is simply not remembered.
  }
}
