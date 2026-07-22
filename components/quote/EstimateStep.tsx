"use client";

import { useEffect, useState, type ReactNode } from "react";

import { InfoTip, StepShell, useFlowVariant } from "@/components/quote/ui";
import type { CombinedMeasurement } from "@/lib/quote-flow";
import { displayQuoteAmount } from "@/lib/quote";
import type { LatLng, QuoteResult } from "@/lib/types";

function useCountUp(target: number, durationMs = 1100, delayMs = 250) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const frame = window.requestAnimationFrame(() => setValue(target));
      return () => window.cancelAnimationFrame(frame);
    }
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start - delayMs;
      if (elapsed < 0) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, delayMs]);
  return value;
}

/* Small line icons for the estimate feature chips. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 flex-none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  area: (
    <Icon>
      <rect x="3" y="8" width="18" height="8" rx="1.5" />
      <path d="M7 8v3M11 8v4M15 8v3" />
    </Icon>
  ),
  gutter: (
    <Icon>
      <path d="M3 8v3a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V8" />
      <path d="M3 8h18" />
    </Icon>
  ),
};

type Chip = { key: string; icon: ReactNode; label: string };

export function EstimateStep({
  quote,
  measurement,
  address,
  contactName,
}: {
  quote: QuoteResult;
  measurement: CombinedMeasurement | null;
  /** Kept for call-site compatibility; the redesign no longer shows a roof image. */
  roofs?: LatLng[][];
  address: string;
  materialLabelText: string;
  jobLabel: string;
  contactName: string;
  mapsEnabled?: boolean;
}) {
  const variant = useFlowVariant();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const min = useCountUp(quote.min, 600, 80);
  const max = useCountUp(quote.max, 600, 80);
  const area = measurement ? Math.round(measurement.surfaceAreaM2) : null;
  const gutter =
    measurement && measurement.gutterLengthM > 0
      ? Math.round(measurement.gutterLengthM)
      : null;
  const firstName = contactName.trim().split(" ")[0] ?? "";
  const showArea = quote.pricingMode !== "roofline" && area !== null;

  const chips: Chip[] = [
    showArea && area !== null
      ? { key: "area", icon: ICONS.area, label: `≈ ${area} m²` }
      : null,
    gutter !== null
      ? { key: "gutter", icon: ICONS.gutter, label: `≈ ${gutter} m gutter` }
      : null,
  ].filter(Boolean) as Chip[];

  return (
    <StepShell className="justify-center">
      {/* Heading + address */}
      <div className="text-center">
        <h1
          tabIndex={-1}
          className={`text-balance font-[family-name:var(--font-poppins)] font-semibold leading-tight tracking-tight text-ink outline-none ${
            variant === "card" ? "text-[1.6rem]" : "text-3xl sm:text-4xl"
          }`}
        >
          {firstName ? `${firstName}, here's` : "Here's"} your estimate
          <InfoTip>
            Your roofer will call to confirm the final price after a free survey
            — this range is indicative, not a contract price.
          </InfoTip>
        </h1>
        <p className="mt-2 flex items-center justify-center gap-1 text-[14px] text-muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-4 flex-none"
            aria-hidden="true"
          >
            <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span className="truncate">{address}</span>
        </p>
      </div>

      {/* Estimate card */}
      <div className="mx-auto mt-6 w-full overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-b from-white to-brand-50/40 shadow-[0_16px_44px_-20px_rgba(31,87,240,0.38)]">
        <div className="px-5 pb-5 pt-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">
            Estimate
          </p>
          <p
            className={`mt-2 font-[family-name:var(--font-poppins)] font-semibold leading-tight tracking-tight text-ink ${
              variant === "card" ? "text-[2.2rem]" : "text-[2rem] sm:text-5xl"
            }`}
          >
            {displayQuoteAmount(min, false)} – {displayQuoteAmount(max, false)}
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-muted">excl. VAT</p>
          {/* Subtle range accent — reads as "this is a spread, not a fixed price". */}
          <div className="mx-auto mt-3.5 h-1.5 w-20 rounded-full bg-gradient-to-r from-brand-200 via-brand-400 to-brand-600" />
        </div>

        {showBreakdown ? (
          <div className="border-t border-brand-100/70 px-5 py-4 text-left">
            <ul className="flex flex-col gap-1.5">
              {quote.lineItems.map((item) => (
                <li
                  key={`${item.label}-${item.rateId ?? ""}`}
                  className="flex items-baseline justify-between gap-4 text-[13px]"
                >
                  <span className="text-ink-soft">{item.label}</span>
                  <span className="flex-none font-semibold text-ink">
                    {displayQuoteAmount(item.min, false)} –{" "}
                    {displayQuoteAmount(item.max, false)}
                  </span>
                </li>
              ))}
            </ul>
            {quote.modelAssumptions.length > 0 ? (
              <p className="mt-3 border-t border-brand-100/70 pt-2.5 text-[11.5px] leading-relaxed text-muted">
                {quote.modelAssumptions.join(" ")}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setShowBreakdown(false)}
              className="mt-3 w-full text-center text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
            >
              Back to estimate
            </button>
          </div>
        ) : (
          <>
            {chips.length > 0 ? (
              <div className="flex flex-col divide-y divide-brand-100/70 border-t border-brand-100/70 sm:flex-row sm:divide-x sm:divide-y-0">
                {chips.map((chip) => (
                  <span
                    key={chip.key}
                    className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-center text-[12.5px] font-medium text-ink-soft"
                  >
                    <span className="text-brand-500">{chip.icon}</span>
                    <span className="truncate">{chip.label}</span>
                  </span>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setShowBreakdown(true)}
              className="w-full border-t border-brand-100/70 py-3.5 text-center text-[13.5px] font-semibold text-brand-600 transition-colors hover:bg-brand-50/60 hover:text-brand-700"
            >
              See what&apos;s included →
            </button>
          </>
        )}
      </div>

      {/* Trust callout */}
      <div className="mx-auto mt-4 flex w-full items-start gap-3 rounded-2xl border border-brand-100/60 bg-brand-50/80 p-4">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="mt-0.5 size-5 flex-none text-brand-600"
          aria-hidden="true"
        >
          <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" opacity="0.18" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3ZM9 12l2 2 4-4"
          />
        </svg>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">Independent &amp; free</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">
            Quoter is 100% independent and your estimate is free.
          </p>
        </div>
      </div>
    </StepShell>
  );
}
