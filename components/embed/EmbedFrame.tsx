"use client";

import { useEffect, useRef } from "react";

import { QuoteBubble } from "@/components/bubble/QuoteBubble";

/**
 * The embeddable surface: renders only the QuoteBubble and continuously
 * reports its size to the parent frame over postMessage, so the host page
 * can grow/shrink the <iframe> to fit.
 *
 * Protocol — messages are { source: "quoter-embed", ... }:
 *   - height:  the widget's current rendered height (px)
 *   - overlay: true when the flow needs the whole screen (mobile, flow open).
 *              The host then pins the iframe to the full viewport; otherwise
 *              it lays the iframe out inline at `height`.
 *   - stage:   "input" | "flow" (useful for host-side styling)
 *
 * This is the same mechanism a roofer's site will use to embed Quoter, so
 * it is the first real piece of the production embed, not landing-only glue.
 */
export function EmbedFrame({ rooferId }: { rooferId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Make the embed document itself transparent so the host page's
    // background (the blue blob) shows through around the card.
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";

    const desktopQuery = window.matchMedia("(min-width: 640px)");
    let lastKey = "";

    // The address-suggestions dropdown overflows below the search bar and,
    // being in an iframe, would be clipped. Report a height that includes it
    // (and any other overflowing overlay) so the host grows the iframe to fit.
    const measureContentBottom = () => {
      let bottom = hostRef.current?.getBoundingClientRect().bottom ?? 0;
      document
        .querySelectorAll<HTMLElement>(".q-suggestions, [role='listbox']")
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.height > 0) bottom = Math.max(bottom, r.bottom);
        });
      return Math.ceil(bottom);
    };

    const post = () => {
      const widget = document.getElementById("quoter-widget");
      const stage = widget?.getAttribute("data-stage") ?? "input";
      const overlay = stage === "flow" && !desktopQuery.matches;
      const height = overlay
        ? Math.ceil(window.innerHeight)
        : measureContentBottom();

      // De-dupe identical frames so we don't spam the parent.
      const key = `${height}|${overlay}|${stage}`;
      if (key === lastKey) return;
      lastKey = key;

      window.parent?.postMessage(
        { source: "quoter-embed", height, overlay, stage },
        "*",
      );
    };

    // Height changes (stage transitions change height too).
    const ro = new ResizeObserver(post);
    if (hostRef.current) ro.observe(hostRef.current);

    // data-stage flips (drives the overlay signal).
    const widget = document.getElementById("quoter-widget");
    const mo = new MutationObserver(post);
    if (widget) {
      mo.observe(widget, { attributes: true, attributeFilter: ["data-stage"] });
    }

    // Host asks us to focus the search input (its own [data-try] buttons
    // can't reach across the frame boundary).
    const onHostMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.source !== "quoter-host") return;
      if (d.action === "focus") {
        const input = document
          .getElementById("quoter-widget")
          ?.querySelector<HTMLInputElement>("input");
        input?.focus();
      }
    };
    window.addEventListener("message", onHostMessage);

    // The suggestions dropdown mounts/animates outside the widget subtree, so
    // also re-measure on typing, focus changes, and any DOM mutation, then
    // once more after the dropdown's enter/exit animation settles.
    const postSoon = () => {
      post();
      window.setTimeout(post, 60);
      window.setTimeout(post, 240);
    };
    const bodyMo = new MutationObserver(postSoon);
    bodyMo.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", postSoon, true);
    document.addEventListener("focusin", postSoon, true);
    document.addEventListener("focusout", () => window.setTimeout(post, 120), true);

    desktopQuery.addEventListener("change", post);
    window.addEventListener("resize", post);
    // A couple of delayed posts catch late layout (fonts, first paint).
    const t1 = window.setTimeout(post, 60);
    const t2 = window.setTimeout(post, 400);
    post();

    return () => {
      ro.disconnect();
      mo.disconnect();
      bodyMo.disconnect();
      document.removeEventListener("input", postSoon, true);
      document.removeEventListener("focusin", postSoon, true);
      window.removeEventListener("message", onHostMessage);
      desktopQuery.removeEventListener("change", post);
      window.removeEventListener("resize", post);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div ref={hostRef} className="quoter-bubble-host mx-auto w-full text-left">
      <QuoteBubble rooferId={rooferId} />
    </div>
  );
}
