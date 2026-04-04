import type {
  CreateBlockingRuleInput,
  CreateTypingRuleInput,
  DashboardSnapshot,
  SettingsUpdateInput,
  StatusSnapshot,
  StatusStats,
  BlockingRule,
  ProcessInfo,
  ShortcutEvent,
  TypingRule,
} from "./types";

let adminToken: string | null = null;

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T | undefined> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const requiresAdminToken = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (requiresAdminToken && adminToken === null) {
    throw new Error(
      "Dashboard session token is unavailable. Refresh the page and try again.",
    );
  }

  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  if (requiresAdminToken && adminToken !== null) {
    headers.set("X-Admin-Token", adminToken);
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      message = response.statusText || "Request failed";
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function requestRequired<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const result = await request<T>(path, init);
  if (result === undefined) {
    throw new Error(`Expected a response body from ${path}.`);
  }

  return result;
}

async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  await request(path, init);
}

export const api = {
  async getDashboard(): Promise<DashboardSnapshot> {
    const [status, stats, rules, typingRules, events, processes] =
      await Promise.all([
        requestRequired<StatusSnapshot>("/api/status"),
        requestRequired<StatusStats>("/api/status/stats"),
        requestRequired<BlockingRule[]>("/api/rules"),
        requestRequired<TypingRule[]>("/api/typing"),
        requestRequired<ShortcutEvent[]>("/api/status/events?limit=100"),
        requestRequired<ProcessInfo[]>("/api/processes"),
      ]);

    adminToken = status.adminToken;

    return { status, stats, rules, typingRules, events, processes };
  },

  toggleGlobal(): Promise<{ globalEnabled: boolean }> {
    return requestRequired("/api/status/toggle", { method: "POST" });
  },

  updateSettings(input: SettingsUpdateInput): Promise<{ success: boolean }> {
    return requestRequired("/api/status/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  createRule(input: CreateBlockingRuleInput): Promise<BlockingRule> {
    return requestRequired("/api/rules", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  toggleRule(id: string): Promise<{ id: string; enabled: boolean }> {
    return requestRequired(`/api/rules/${id}/toggle`, { method: "POST" });
  },

  deleteRule(id: string): Promise<void> {
    return requestVoid(`/api/rules/${id}`, { method: "DELETE" });
  },

  createTypingRule(input: CreateTypingRuleInput): Promise<TypingRule> {
    return requestRequired("/api/typing", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  toggleTypingRule(id: string): Promise<{ id: string; enabled: boolean }> {
    return requestRequired(`/api/typing/${id}/toggle`, { method: "POST" });
  },

  deleteTypingRule(id: string): Promise<void> {
    return requestVoid(`/api/typing/${id}`, { method: "DELETE" });
  },

  fireTypingRule(
    id: string,
    body: { text?: string; preDelayMs?: number },
  ): Promise<{ queued: boolean }> {
    return requestRequired(`/api/typing/${id}/fire`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  clearEvents(): Promise<void> {
    return requestVoid("/api/status/events", { method: "DELETE" });
  },
};
