"use client";

/**
 * Free address entry: UK postcode + house/street free text.
 * No Google Places Autocomplete — geocode stays on /api/geocode (postcodes.io).
 */

import { useState } from "react";

import { flowInputClass, flowLabelClass } from "@/components/quote/ui";
import {
  looksLikeUkPostcode,
  prettyPostcode,
} from "@/lib/postcode";

type AddressEntryProps = {
  line: string;
  postcode: string;
  onLineChange: (value: string) => void;
  onPostcodeChange: (value: string) => void;
  /** "flow" = wizard (postcode + house); "bare" = bubble search (postcode only). */
  variant?: "flow" | "bare";
  autoFocus?: boolean;
  onSubmit?: () => void;
};

type FieldStatus = "idle" | "valid" | "invalid";

function FieldStatusIcon({ status }: { status: FieldStatus }) {
  if (status === "idle") return null;

  const ok = status === "valid";
  return (
    <span
      className={`pointer-events-none absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full ${
        ok ? "bg-emerald-500/12 text-emerald-600" : "bg-red-500/12 text-red-500"
      }`}
      aria-hidden="true"
    >
      {ok ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.5 9.5 17 19 7.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 6l12 12M18 6 6 18"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}

function postcodeStatus(value: string, showInvalid: boolean): FieldStatus {
  if (!value.trim()) return "idle";
  if (looksLikeUkPostcode(value)) return "valid";
  return showInvalid ? "invalid" : "idle";
}

function lineStatus(value: string, showInvalid: boolean): FieldStatus {
  const trimmed = value.trim();
  if (!trimmed) return "idle";
  if (trimmed.length > 2) return "valid";
  return showInvalid ? "invalid" : "idle";
}

function statusBorderClass(status: FieldStatus): string {
  if (status === "valid") return "border-emerald-400/80 focus:border-emerald-400";
  if (status === "invalid") return "border-red-400 focus:border-red-400 focus:ring-red-500/15";
  return "";
}

export function AddressEntry({
  line,
  postcode,
  onLineChange,
  onPostcodeChange,
  variant = "flow",
  autoFocus = false,
  onSubmit,
}: AddressEntryProps) {
  const [postcodeTouched, setPostcodeTouched] = useState(false);
  const [lineTouched, setLineTouched] = useState(false);

  if (variant === "bare") {
    return (
      <div className="q-bare-field">
        <input
          id="quoter-postcode"
          type="text"
          value={postcode}
          onChange={(event) =>
            onPostcodeChange(event.target.value.toUpperCase())
          }
          onBlur={() => {
            if (looksLikeUkPostcode(postcode)) {
              onPostcodeChange(prettyPostcode(postcode));
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit?.();
            }
          }}
          placeholder="Enter your postcode"
          autoComplete="postal-code"
          autoFocus={autoFocus}
          spellCheck={false}
          className="q-bare-input"
          aria-label="Enter your postcode"
        />
      </div>
    );
  }

  const postcodeState = postcodeStatus(postcode, postcodeTouched);
  const lineState = lineStatus(line, lineTouched);

  return (
    <div className="space-y-4">
      <div>
        <label className={flowLabelClass} htmlFor="quote-postcode">
          Postcode
        </label>
        <div className="relative">
          <input
            id="quote-postcode"
            type="text"
            value={postcode}
            onChange={(event) =>
              onPostcodeChange(event.target.value.toUpperCase())
            }
            onBlur={() => {
              setPostcodeTouched(true);
              if (looksLikeUkPostcode(postcode)) {
                onPostcodeChange(prettyPostcode(postcode));
              }
            }}
            placeholder="e.g. SW1A 2AA"
            autoComplete="postal-code"
            autoFocus={autoFocus}
            spellCheck={false}
            aria-invalid={postcodeState === "invalid"}
            className={`${flowInputClass} pr-11 ${statusBorderClass(postcodeState)}`}
          />
          <FieldStatusIcon status={postcodeState} />
        </div>
      </div>
      <div>
        <label className={flowLabelClass} htmlFor="quote-address">
          House number and street
        </label>
        <div className="relative">
          <input
            id="quote-address"
            type="text"
            value={line}
            onChange={(event) => onLineChange(event.target.value)}
            onBlur={() => setLineTouched(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setPostcodeTouched(true);
                setLineTouched(true);
                onSubmit?.();
              }
            }}
            placeholder="e.g. 12 Oakfield Road"
            autoComplete="street-address"
            aria-invalid={lineState === "invalid"}
            className={`${flowInputClass} pr-11 ${statusBorderClass(lineState)}`}
          />
          <FieldStatusIcon status={lineState} />
        </div>
      </div>
    </div>
  );
}

export function addressEntryReady(line: string, postcode: string): boolean {
  return line.trim().length > 2 && looksLikeUkPostcode(postcode);
}
