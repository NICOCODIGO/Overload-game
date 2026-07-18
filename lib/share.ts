/**
 * Share-text builder + clipboard helper.
 * Format: "Overload: Signal Rush #12 — Level 9 ⚡ — ✅✅✅❌ — beat me: <url>"
 */

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function buildShareText(opts: {
  gameName: string;
  dailyNum: number | null; // null = practice run
  scoreLine: string;
  emojis: string;
  path: string;
}): string {
  const tag = opts.dailyNum ? ` #${opts.dailyNum}` : " (practice)";
  const url = `${siteUrl()}${opts.path}`;
  return `Overload: ${opts.gameName}${tag} — ${opts.scoreLine} — ${opts.emojis} — beat me: ${url}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older mobile browsers: hidden-textarea fallback.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
