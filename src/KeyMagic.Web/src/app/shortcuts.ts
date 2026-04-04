const specialKeyCodes: Record<string, number> = {
  backspace: 0x08,
  tab: 0x09,
  enter: 0x0d,
  escape: 0x1b,
  esc: 0x1b,
  space: 0x20,
  pageup: 0x21,
  pagedown: 0x22,
  end: 0x23,
  home: 0x24,
  left: 0x25,
  up: 0x26,
  right: 0x27,
  down: 0x28,
  insert: 0x2d,
  delete: 0x2e,
  ";": 0xba,
  "=": 0xbb,
  ",": 0xbc,
  "-": 0xbd,
  ".": 0xbe,
  "/": 0xbf,
  "`": 0xc0,
  "[": 0xdb,
  "\\": 0xdc,
  "]": 0xdd,
  "'": 0xde,
};

export function normalizeKeyLabel(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function getVirtualKeyCode(value: string): number | null {
  const normalized = normalizeKeyLabel(value);
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(specialKeyCodes, lowered)) {
    return specialKeyCodes[lowered];
  }

  if (/^[a-z]$/i.test(normalized)) {
    return normalized.toUpperCase().charCodeAt(0);
  }

  if (/^[0-9]$/.test(normalized)) {
    return normalized.charCodeAt(0);
  }

  const functionMatch = /^f(\d{1,2})$/i.exec(normalized);
  if (functionMatch) {
    const number = Number(functionMatch[1]);
    if (number >= 1 && number <= 12) {
      return 0x6f + number;
    }
  }

  return null;
}

export function buildShortcutDisplay(
  keyLabel: string,
  modifiers: { ctrl: boolean; alt: boolean; shift: boolean; win: boolean },
): string {
  const parts = [
    modifiers.ctrl ? "Ctrl" : "",
    modifiers.alt ? "Alt" : "",
    modifiers.shift ? "Shift" : "",
    modifiers.win ? "Win" : "",
    normalizeKeyLabel(keyLabel),
  ].filter(Boolean);

  return parts.join("+");
}
