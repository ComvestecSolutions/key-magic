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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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

export const api = {
  async getDashboard(): Promise<DashboardSnapshot> {
    const [status, stats, rules, typingRules, events, processes] =
      await Promise.all([
        request<StatusSnapshot>("/api/status"),
        request<StatusStats>("/api/status/stats"),
        request<BlockingRule[]>("/api/rules"),
        request<TypingRule[]>("/api/typing"),
        request<ShortcutEvent[]>("/api/status/events?limit=100"),
        request<ProcessInfo[]>("/api/processes"),
      ]);

    return { status, stats, rules, typingRules, events, processes };
  },

  toggleGlobal(): Promise<{ globalEnabled: boolean }> {
    return request("/api/status/toggle", { method: "POST" });
  },

  updateSettings(input: SettingsUpdateInput): Promise<{ success: boolean }> {
    return request("/api/status/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  createRule(input: CreateBlockingRuleInput): Promise<BlockingRule> {
    return request("/api/rules", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  toggleRule(id: string): Promise<{ id: string; enabled: boolean }> {
    return request(`/api/rules/${id}/toggle`, { method: "POST" });
  },

  deleteRule(id: string): Promise<void> {
    return request(`/api/rules/${id}`, { method: "DELETE" });
  },

  createTypingRule(input: CreateTypingRuleInput): Promise<TypingRule> {
    return request("/api/typing", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  toggleTypingRule(id: string): Promise<{ id: string; enabled: boolean }> {
    return request(`/api/typing/${id}/toggle`, { method: "POST" });
  },

  deleteTypingRule(id: string): Promise<void> {
    return request(`/api/typing/${id}`, { method: "DELETE" });
  },

  fireTypingRule(
    id: string,
    body: { text?: string; preDelayMs?: number },
  ): Promise<{ queued: boolean }> {
    return request(`/api/typing/${id}/fire`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  clearEvents(): Promise<void> {
    return request("/api/status/events", { method: "DELETE" });
  },
};
