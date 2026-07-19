"use client";

import { useEffect, useState } from "react";

import { EstimateReveal } from "@/components/quote/EstimateReveal";
import { StepHeading, StepShell, useFlowVariant } from "@/components/quote/ui";
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

export function EstimateStep({
  quote,
  measurement,
  roofs,
  address,
  materialLabelText,
  jobLabel,
  contactName,
  mapsEnabled = false,
}: {
  quote: QuoteResult;
  measurement: CombinedMeasurement | null;
  roofs: LatLng[][];
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
  const firstName = contactName.trim().split(" ")[0] ?? "";
  const showArea = quote.pricingMode !== "roofline" && area !== null;
  const hasRoofs = roofs.some((path) => path.length >= 3);

  return (
    <StepShell
      className={
        variant === "page" ? "justify-center pb-20 pt-8 sm:pt-10" : undefined
      }
    >
      <StepHeading
        sub={address}
        info="Your roofer will call to confirm the final price after a free survey — this range is indicative, not a contract price."
        compact
      >
        {firstName ? `${firstName}, here's` : "Here's"} your estimate
      </StepHeading>

      {showBreakdown && variant === "card" ? (
        <div
          className={`grid min-h-0 flex-1 gap-3 rounded-2xl border border-line bg-white p-2.5 ${
            hasRoofs ? "grid-cols-[104px_minmax(0,1fr)]" : ""
          }`}
        >
          {hasRoofs ? (
            <EstimateReveal
              roofs={roofs}
              mapsEnabled={mapsEnabled}
              className="size-[104px] self-start"
            />
          ) : null}
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-ink-soft">What&apos;s included</p>
              <button
                type="button"
                onClick={() => setShowBreakdown(false)}
                className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600"
              >
                Back to estimate
              </button>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {quote.lineItems.map((item) => (
                <li
                  key={`${item.label}-${item.rateId ?? ""}`}
                  className="min-w-0 text-[11px] leading-tight"
                >
                  <span className="block truncate text-ink-soft">{item.label}</span>
                  <span className="text-[12px] font-semibold text-ink">
                    {displayQuoteAmount(item.min, false)} – {displayQuoteAmount(item.max, false)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-line pt-1.5 text-[10px] leading-snug text-muted">
              Indicative local rates, excluding VAT. Final price follows survey.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`flex items-center gap-3 ${
              variant === "card" ? "mt-2" : "mt-4 gap-5"
            }`}
          >
            {hasRoofs ? (
              <EstimateReveal
                roofs={roofs}
                mapsEnabled={mapsEnabled}
                className={variant === "card" ? "size-28 shrink-0" : "size-40 shrink-0"}
              />
            ) : null}
            <div className={`min-w-0 flex-1 ${hasRoofs ? "" : "text-center"}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
                Estimate
              </p>
              <p
                className={`mt-1 font-[family-name:var(--font-poppins)] font-semibold tracking-tight text-ink ${
                  variant === "card" ? "text-[1.8rem] leading-none" : "text-4xl"
                }`}
              >
                {displayQuoteAmount(min, false)}&nbsp;–&nbsp;
                {displayQuoteAmount(max, false)}
              </p>
              <p className="mt-2 text-[12px] leading-snug text-muted">
                {showArea ? `≈ ${area} m² · ` : ""}
                {measurement && measurement.gutterLengthM > 0
                  ? `≈ ${Math.round(measurement.gutterLengthM)} m gutter · `
                  : ""}
                {materialLabelText.toLowerCase()} · {jobLabel.toLowerCase()} · excl.
                VAT
              </p>
              {variant === "card" ? (
                <button
                  type="button"
                  onClick={() => setShowBreakdown(true)}
                  className="mt-3 text-[12px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
                >
                  See what&apos;s included →
                </button>
              ) : null}
            </div>
          </div>

          {variant === "page" ? (
            <details className="mt-7 rounded-2xl border border-line bg-white p-4 open:pb-5">
              <summary className="cursor-pointer text-[14px] font-semibold text-ink-soft">
                What&apos;s included in this range
              </summary>
              <ul className="mt-3 flex flex-col gap-2">
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
                <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">
                  {quote.modelAssumptions.join(" ")}
                </p>
              ) : null}
            </details>
          ) : null}
        </>
      )}
    </StepShell>
  );
}
