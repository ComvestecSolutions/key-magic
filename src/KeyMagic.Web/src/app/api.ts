import type {
  BatchCreateBlockingRulesInput,
  BatchUpdateBlockingRulesInput,
  CreateBlockingRuleInput,
  CreateTypingRuleInput,
  DashboardSnapshot,
  KeyMagicConfig,
  SettingsUpdateInput,
  StatusSnapshot,
  StatusStats,
  BlockingRule,
  ProcessInfo,
  ShortcutEvent,
  TypingRule,
  UpdateBlockingRuleInput,
  UpdateTypingRuleInput,
} from "./types";

interface RequestOptions {
  allowAdminTokenRefresh?: boolean;
  skipAdminToken?: boolean;
}

const dashboardSession = {
  adminToken: null as string | null,
  refreshPromise: null as Promise<string> | null,
};

function setAdminToken(token: string) {
  dashboardSession.adminToken = token;
}

async function refreshAdminToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && dashboardSession.adminToken !== null) {
    return dashboardSession.adminToken;
  }

  if (dashboardSession.refreshPromise === null) {
    dashboardSession.refreshPromise = requestRequired<StatusSnapshot>(
      "/api/status",
      undefined,
      {
        allowAdminTokenRefresh: false,
        skipAdminToken: true,
      },
    )
      .then((status) => {
        setAdminToken(status.adminToken);
        return status.adminToken;
      })
      .finally(() => {
        dashboardSession.refreshPromise = null;
      });
  }

  return dashboardSession.refreshPromise;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options: RequestOptions = {},
): Promise<T | undefined> {
  const { allowAdminTokenRefresh = true, skipAdminToken = false } = options;
  const method = init?.method?.toUpperCase() ?? "GET";
  const requiresAdminToken =
    !skipAdminToken && !["GET", "HEAD", "OPTIONS"].includes(method);

  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (requiresAdminToken) {
    headers.set("X-Admin-Token", await refreshAdminToken());
  }

  const buildRequestInit = (): RequestInit => ({
    ...init,
    headers,
  });

  let response = await fetch(path, buildRequestInit());

  if (
    requiresAdminToken
    && allowAdminTokenRefresh
    && (response.status === 401 || response.status === 403)
  ) {
    headers.set("X-Admin-Token", await refreshAdminToken(true));
    response = await fetch(path, buildRequestInit());
  }

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
    return undefined;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function requestRequired<T>(
  path: string,
  init?: RequestInit,
  options?: RequestOptions,
): Promise<T> {
  const result = await request<T>(path, init, options);
  if (result === undefined) {
    throw new Error(`Expected a response body from ${path}.`);
  }

  return result;
}

async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  await request<never>(path, init);
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

    setAdminToken(status.adminToken);

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

  updateRule(
    id: string,
    input: UpdateBlockingRuleInput,
  ): Promise<BlockingRule> {
    return requestRequired(`/api/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  updateTypingRule(
    id: string,
    input: UpdateTypingRuleInput,
  ): Promise<TypingRule> {
    return requestRequired(`/api/typing/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  exportConfig(): Promise<KeyMagicConfig> {
    return requestRequired("/api/status/config");
  },

  importConfig(config: KeyMagicConfig): Promise<{ success: boolean }> {
    return requestRequired("/api/status/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  },

  batchDeleteRules(ids: string[]): Promise<{ removed: number }> {
    return requestRequired("/api/rules/batch", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  },

  batchCreateRules(
    input: BatchCreateBlockingRulesInput,
  ): Promise<BlockingRule[]> {
    return requestRequired("/api/rules/batch", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  batchToggleRules(
    ids: string[],
    enabled: boolean,
  ): Promise<{ updated: number; enabled: boolean }> {
    return requestRequired("/api/rules/batch-toggle", {
      method: "POST",
      body: JSON.stringify({ ids, enabled }),
    });
  },

  batchUpdateRules(
    input: BatchUpdateBlockingRulesInput,
  ): Promise<{ updated: number }> {
    return requestRequired("/api/rules/batch", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
};
