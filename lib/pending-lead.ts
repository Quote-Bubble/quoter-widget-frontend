import { apiUrl } from "@/lib/api";

/**
 * Resilient lead delivery. A lead is the one thing this widget exists to
 * capture, so losing one to a network blip after the homeowner did the whole
 * flow is the worst outcome. Two safety nets:
 *
 *  1. Retry with backoff on the POST itself.
 *  2. Stash the payload in localStorage BEFORE sending and only clear it once
 *     the backend confirms. If the tab is reloaded / crashes mid-send, the next
 *     mount re-sends it (see flushPendingLead) so it isn't silently lost.
 */

const KEY = "quoter_pending_lead";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // don't resurrect ancient drafts

// Body includes the anti-spam fields alongside the lead payload.
export type LeadBody = Record<string, unknown>;

function safeGet(): { body: LeadBody; savedAt: number } | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { body: LeadBody; savedAt: number };
    if (!parsed?.body || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePendingLead(body: LeadBody): void {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ body, savedAt: Date.now() }),
    );
  } catch {
    // Private mode / quota — retry-in-memory still applies, just no resurrection.
  }
}

export function clearPendingLead(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

async function postOnce(body: LeadBody): Promise<Response> {
  return fetch(apiUrl("/api/lead"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type LeadResult =
  | { ok: true }
  | { ok: false; message: string; retriable: boolean };

/** POST the lead, retrying transient failures a few times with backoff. */
export async function postLeadWithRetry(
  body: LeadBody,
  attempts = 3,
): Promise<LeadResult> {
  let lastMessage = "We couldn't send your details. Please try again.";
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await postOnce(body);
      if (response.ok) return { ok: true };
      // 4xx is a real rejection (bad input) — don't keep retrying it.
      if (response.status >= 400 && response.status < 500) {
        const parsed = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        return {
          ok: false,
          message: parsed?.error ?? "Please check your details and try again.",
          retriable: false,
        };
      }
      lastMessage = "We couldn't send your details. Please try again.";
    } catch {
      lastMessage = "Something went wrong. Check your connection and try again.";
    }
    // Backoff before the next attempt (skip the wait after the last one).
    if (attempt < attempts - 1) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, 400 * (attempt + 1)),
      );
    }
  }
  return { ok: false, message: lastMessage, retriable: true };
}

/**
 * On mount, quietly re-send any lead that was stashed but never confirmed
 * (tab closed / reloaded mid-send). Best-effort; clears on success.
 */
export function flushPendingLead(): void {
  if (typeof window === "undefined") return;
  const pending = safeGet();
  if (!pending) return;
  if (Date.now() - pending.savedAt > MAX_AGE_MS) {
    clearPendingLead();
    return;
  }
  void postLeadWithRetry(pending.body, 2).then((result) => {
    if (result.ok) clearPendingLead();
  });
}
