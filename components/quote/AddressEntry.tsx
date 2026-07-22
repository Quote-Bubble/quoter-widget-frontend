"use client";

/**
 * Free address entry: UK postcode + house/street free text.
 * No Google Places Autocomplete — geocode stays on /api/geocode (postcodes.io).
 */

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

export function AddressEntry({
  line,
  postcode,
  onLineChange,
  onPostcodeChange,
  variant = "flow",
  autoFocus = false,
  onSubmit,
}: AddressEntryProps) {
  if (variant === "bare") {
    return (
      <div className="relative min-w-0 flex-1">
        <label className="q-sr-only" htmlFor="quoter-postcode">
          Postcode
        </label>
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
          aria-label="Your postcode"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={flowLabelClass} htmlFor="quote-postcode">
          Postcode
        </label>
        <input
          id="quote-postcode"
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
          placeholder="e.g. SW1A 2AA"
          autoComplete="postal-code"
          autoFocus={autoFocus}
          spellCheck={false}
          className={flowInputClass}
        />
      </div>
      <div>
        <label className={flowLabelClass} htmlFor="quote-address">
          House number and street
        </label>
        <input
          id="quote-address"
          type="text"
          value={line}
          onChange={(event) => onLineChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit?.();
            }
          }}
          placeholder="e.g. 12 Oakfield Road"
          autoComplete="street-address"
          className={flowInputClass}
        />
      </div>
    </div>
  );
}

export function addressEntryReady(line: string, postcode: string): boolean {
  return line.trim().length > 2 && looksLikeUkPostcode(postcode);
}
