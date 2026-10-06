// Link with the RG360 suite: the landing (tools.rollergrind360.com) owns sign-in.
const SESSION_KEY = "rg360.session";

/** Apps grid of the RG360 landing: the home of the suite. */
export const SUITE_HOME_URL =
  import.meta.env.VITE_SUITE_HOME_URL ?? (import.meta.env.DEV ? "http://localhost:8080/apps" : "/apps");

// In local dev every app runs on its own port (separate storage), so the landing
// passes the session in the URL fragment. Production shares one origin and skips this.
export function consumeSessionHandoff() {
  if (!import.meta.env.DEV || !window.location.hash.includes("rg360-session=")) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  try {
    const session = JSON.parse(params.get("rg360-session") ?? "null");
    if (session?.token) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore malformed handoffs: the user can always sign in again from the landing.
  }
  try {
    const prefs = JSON.parse(params.get("rg360-prefs") ?? "null");
    if (prefs?.language) localStorage.setItem(LANGUAGE_KEY, prefs.language);
    if (prefs?.theme) localStorage.setItem(THEME_KEY, prefs.theme);
  } catch {
    // Keep the previous preferences.
  }
  window.history.replaceState({}, "", window.location.pathname + window.location.search);
}

// ---- Suite preferences (chosen in the landing, shared by every RG360 app) ----
const LANGUAGE_KEY = "rg360.language";
const THEME_KEY = "rg360.theme";

/** Suite language: "es", "ca" or "en". */
export function readSuiteLanguage(): "es" | "ca" | "en" {
  const value = localStorage.getItem(LANGUAGE_KEY);
  return value === "ca" || value === "en" ? value : "es";
}

/** Suite theme resolved to light/dark ("system" follows the operating system). */
export function readSuiteTheme(): "light" | "dark" {
  const value = localStorage.getItem(THEME_KEY);
  if (value === "light" || value === "dark") return value;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
