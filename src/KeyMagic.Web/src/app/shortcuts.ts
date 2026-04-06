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

const modifierAliases: Record<string, "ctrl" | "alt" | "shift" | "win"> = {
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  shift: "shift",
  os: "win",
  win: "win",
  meta: "win",
  windows: "win",
};

const keyboardAliases: Record<string, string> = {
  Backspace: "Backspace",
  Tab: "Tab",
  Enter: "Enter",
  Escape: "Escape",
  Esc: "Escape",
  " ": "Space",
  Spacebar: "Space",
  PageUp: "PageUp",
  PageDown: "PageDown",
  End: "End",
  Home: "Home",
  ArrowLeft: "Left",
  ArrowUp: "Up",
  ArrowRight: "Right",
  ArrowDown: "Down",
  Insert: "Insert",
  Delete: "Delete",
  ";": ";",
  "=": "=",
  ",": ",",
  "-": "-",
  ".": ".",
  "/": "/",
  "`": "`",
  "[": "[",
  "\\": "\\",
  "]": "]",
  "'": "'",
};

const modifierKeys = new Set(["Control", "Shift", "Alt", "Meta", "OS"]);

export const shortcutQuickKeys = [
  "Escape",
  "Tab",
  "Enter",
  "Space",
  "F1",
  "F5",
  "F12",
  "/",
  ";",
] as const;

export const shortcutReferenceGroups = [
  {
    label: "Letters",
    keys: [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "Z",
    ],
  },
  {
    label: "Numbers",
    keys: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  },
  {
    label: "Function",
    keys: [
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12",
    ],
  },
  {
    label: "Navigation",
    keys: [
      "Escape",
      "Tab",
      "Enter",
      "Space",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      "Left",
      "Up",
      "Right",
      "Down",
      "Insert",
      "Delete",
      "Backspace",
    ],
  },
  {
    label: "Symbols",
    keys: [";", "=", ",", "-", ".", "/", "`", "[", "\\", "]", "'"],
  },
] as const;

export function normalizeKeyLabel(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function isModifierOnlyKey(value: string): boolean {
  return modifierKeys.has(value);
}

export function getKeyLabelFromKeyboardKey(value: string): string | null {
  if (!value) {
    return null;
  }

  if (isModifierOnlyKey(value)) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(keyboardAliases, value)) {
    return keyboardAliases[value];
  }

  if (/^[a-z]$/i.test(value)) {
    return value.toUpperCase();
  }

  if (/^[0-9]$/.test(value)) {
    return value;
  }

  const functionMatch = /^F(\d{1,2})$/i.exec(value);
  if (functionMatch) {
    const number = Number(functionMatch[1]);
    if (number >= 1 && number <= 12) {
      return `F${number}`;
    }
  }

  return null;
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

export function parseShortcutDisplay(value: string): {
  keyLabel: string;
  virtualKeyCode: number;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  win: boolean;
  displayName: string;
} | null {
  const parts = value
    .split("+")
    .map((part) => normalizeKeyLabel(part))
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const keyLabel = parts[parts.length - 1];
  const ctrl = false;
  const alt = false;
  const shift = false;
  const win = false;
  const modifiers = { ctrl, alt, shift, win };

  for (const token of parts.slice(0, -1)) {
    const alias = modifierAliases[token.toLowerCase()];
    if (!alias) {
      return null;
    }
    modifiers[alias] = true;
  }

  const virtualKeyCode = getVirtualKeyCode(keyLabel);
  if (virtualKeyCode == null) {
    return null;
  }

  return {
    keyLabel,
    virtualKeyCode,
    ...modifiers,
    displayName: buildShortcutDisplay(keyLabel, modifiers),
  };
}
