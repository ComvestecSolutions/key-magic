export interface ShortcutKey {
  id: string;
  displayName: string;
  virtualKeyCode: number;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  win: boolean;
}

export interface BlockingRule {
  id: string;
  shortcut: ShortcutKey;
  targetProcesses: string[];
  enabled: boolean;
  description: string;
  createdAt: string;
}

export type TextSource = 0 | 1;

export interface TypingRule {
  id: string;
  name: string;
  hotkey: ShortcutKey;
  source: TextSource;
  text: string;
  interKeyDelayMs: number;
  enabled: boolean;
  createdAt: string;
}

export interface ShortcutEvent {
  timestamp: string;
  shortcutDisplay: string;
  processName: string;
  windowTitle: string;
  wasBlocked: boolean;
  ruleId: string;
}

export interface ProcessInfo {
  processName: string;
  windowTitle: string;
  instanceCount: number;
}

export interface StatusSnapshot {
  globalEnabled: boolean;
  hookActive: boolean;
  totalRules: number;
  activeRules: number;
  showNotifications: boolean;
  trayIconVisible: boolean;
  logPassThrough: boolean;
  allowSingleKeyBlocking: boolean;
  maxLogEntries: number;
  startWithWindows: boolean;
  startEnabled: boolean;
  activeProfile: string;
  profiles: string[];
  notificationSound: boolean;
  notificationDurationMs: number;
  webDashboardPort: number;
  adminToken: string;
}

export interface StatusStats {
  totalEvents: number;
  blockedCount: number;
  passedCount: number;
  topBlocked: Array<{ shortcut: string; count: number }>;
  topProcesses: Array<{ process: string; count: number }>;
}

export interface DashboardSnapshot {
  status: StatusSnapshot;
  stats: StatusStats;
  rules: BlockingRule[];
  typingRules: TypingRule[];
  events: ShortcutEvent[];
  processes: ProcessInfo[];
}

export interface CreateBlockingRuleInput {
  displayName: string;
  virtualKeyCode: number;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  win: boolean;
  targetProcesses: string[];
  description?: string;
}

export interface CreateTypingRuleInput {
  name: string;
  displayName: string;
  virtualKeyCode: number;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  win: boolean;
  source: TextSource;
  text: string;
  interKeyDelayMs: number;
  enabled: boolean;
}

export interface SettingsUpdateInput {
  showNotifications: boolean;
  trayIconVisible: boolean;
  logPassThrough: boolean;
  allowSingleKeyBlocking: boolean;
  maxLogEntries: number;
  startWithWindows: boolean;
  startEnabled: boolean;
  notificationSound: boolean;
  notificationDurationMs: number;
}
