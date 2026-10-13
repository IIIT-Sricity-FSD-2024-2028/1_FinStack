import { useEffect } from "react";
import { currentSession, request } from "./session";
export interface Preferences {
  theme: "dark" | "light" | "system";
  compactMode: boolean;
  animations: boolean;
  language: string;
  dateFormat: string;
  timezone: string;
  numberLocale: string;
  desktopNotifications: boolean;
  defaultView: string;
  pageSize: number;
  autoRefresh: boolean;
}
const defaults: Preferences = {
  theme: "dark",
  compactMode: false,
  animations: true,
  language: "en-US",
  dateFormat: "DD/MM/YYYY",
  timezone: "Asia/Kolkata",
  numberLocale: "en-US",
  desktopNotifications: false,
  defaultView: "dashboard",
  pageSize: 25,
  autoRefresh: false,
};
function key() {
  const session = currentSession();
  return `finstack-preferences:${session?.organizationId}:${session?.user.id}`;
}
export function readPreferences(): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem(key()) || "{}");
    const values = { ...defaults, ...raw };
    if (!["dark", "light", "system"].includes(values.theme))
      values.theme = "dark";
    for (const [name, allowed] of Object.entries({
      language: ["en-US", "en-GB"],
      dateFormat: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
      timezone: [
        "Asia/Kolkata",
        "America/Los_Angeles",
        "America/Denver",
        "America/Chicago",
        "America/New_York",
        "UTC",
      ],
      numberLocale: ["en-US", "de-DE", "fr-FR"],
    }))
      if (!allowed.includes(values[name]))
        values[name] = defaults[name as keyof Preferences];
    for (const name of [
      "compactMode",
      "animations",
      "desktopNotifications",
      "autoRefresh",
    ] as const)
      if (typeof values[name] !== "boolean") values[name] = defaults[name];

    if (![10, 25, 50, 100].includes(values.pageSize)) values.pageSize = 25;
    if (
      !["dashboard", "notifications", "audit-logs"].includes(values.defaultView)
    )
      values.defaultView = "dashboard";
    return values;
  } catch {
    return { ...defaults };
  }
}
export async function savePreferences(values: Preferences) {
  const saved = await request<Preferences>(
    "/api/v1/tenant/configuration/settings/preferences",
    { method: "PATCH", body: values },
  );
  localStorage.setItem(key(), JSON.stringify(saved));
  window.dispatchEvent(new Event("finstack:preferences"));
  return saved;
}
function applyTheme(theme: Preferences["theme"]) {
  const root = document.getElementById("finstack-client-root");
  const systemLight = window.matchMedia?.(
    "(prefers-color-scheme: light)",
  ).matches;
  root?.setAttribute(
    "data-theme",
    theme === "system" ? (systemLight ? "light" : "dark") : theme,
  );
  root?.setAttribute("data-theme-mode", theme);
}
export function applyCachedThemeBeforeRender() {
  try {
    const session = currentSession();
    const cacheKey = `finstack-preferences:${session?.organizationId}:${session?.user.id}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "{}");
    applyTheme(
      ["dark", "light", "system"].includes(cached.theme)
        ? cached.theme
        : "dark",
    );
  } catch {
    applyTheme("dark");
  }
}
export function formatPreferredDate(value: string) {
  if (!value) return "?";
  const prefs = readPreferences();
  try {
    const parts = new Intl.DateTimeFormat(prefs.language, {
      timeZone: prefs.timezone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).formatToParts(new Date(value));
    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value;
    return prefs.dateFormat === "YYYY-MM-DD"
      ? `${part("year")}-${part("month")}-${part("day")}`
      : prefs.dateFormat === "MM/DD/YYYY"
        ? `${part("month")}/${part("day")}/${part("year")}`
        : `${part("day")}/${part("month")}/${part("year")}`;
  } catch {
    return new Date(value).toLocaleDateString();
  }
}
export function preferredMoney(value: string, currency: string) {
  return new Intl.NumberFormat(readPreferences().numberLocale, {
    style: "currency",
    currency,
  }).format(Number(value));
}
export function useWorkspacePreferences() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let active = true;
    let previousIds: Set<string> | null = null;
    const apply = () => {
      const prefs = readPreferences();
      const root = document.getElementById("finstack-client-root");
      applyTheme(prefs.theme);
      root?.classList.toggle("compact-workspace", prefs.compactMode);
      root?.classList.toggle("reduced-workspace-motion", !prefs.animations);
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (prefs.autoRefresh)
          window.dispatchEvent(new Event("finstack:dashboard-refresh"));
        if (
          prefs.desktopNotifications &&
          "Notification" in window &&
          Notification.permission === "granted"
        )
          request<{ items: { id: string; title: string; message: string }[] }>(
            "/api/v1/tenant/expenses/notifications/page?page=1&pageSize=25&state=unread",
          )
            .then((data) => {
              if (!active) return;
              const ids = new Set(data.items.map((item) => item.id));
              if (previousIds)
                for (const item of data.items)
                  if (!previousIds.has(item.id))
                    new Notification(item.title, { body: item.message });
              previousIds = ids;
            })
            .catch(() => {});
      }, 60000);
    };
    apply();
    if (currentSession()) {
      request<Preferences>("/api/v1/tenant/configuration/settings/preferences")
        .then((prefs) => {
          if (!active) return;
          localStorage.setItem(key(), JSON.stringify(prefs));
          window.dispatchEvent(new Event("finstack:preferences"));
        })
        .catch(() => {});
    }
    const colorScheme = window.matchMedia?.("(prefers-color-scheme: light)");
    const onSystemTheme = () => {
      if (readPreferences().theme === "system") applyTheme("system");
    };
    colorScheme?.addEventListener?.("change", onSystemTheme);
    window.addEventListener("finstack:preferences", apply);
    window.addEventListener("storage", apply);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      window.removeEventListener("finstack:preferences", apply);
      window.removeEventListener("storage", apply);
      colorScheme?.removeEventListener?.("change", onSystemTheme);
      document
        .getElementById("finstack-client-root")
        ?.classList.remove("compact-workspace", "reduced-workspace-motion");
    };
  }, []);
}
