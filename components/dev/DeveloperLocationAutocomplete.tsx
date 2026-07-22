"use client";

import { looksLikeUkPostcode, prettyPostcode } from "@/lib/postcode";

type DeveloperLocationAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (formattedAddress: string, postcode: string) => void;
  disabled?: boolean;
};

/**
 * Dev-lab address entry without Google Places (avoids Autocomplete billing).
 * Expect "house, POSTCODE" or free text; postcode is extracted when present.
 */
export function DeveloperLocationAutocomplete({
  value,
  onChange,
  onSelect,
  disabled = false,
}: DeveloperLocationAutocompleteProps) {
  function commit() {
    const trimmed = value.trim();
    if (trimmed.length < 3) return;
    const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
    const maybePostcode = parts.length > 1 ? parts[parts.length - 1] : "";
    const postcode = looksLikeUkPostcode(maybePostcode)
      ? prettyPostcode(maybePostcode)
      : "";
    const line =
      postcode && parts.length > 1 ? parts.slice(0, -1).join(", ") : trimmed;
    onSelect(postcode ? `${line}, ${postcode}` : line, postcode);
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        placeholder="House and street, postcode (e.g. 12 Oakfield Road, SW1A 2AA)"
        className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={disabled || value.trim().length < 3}
        onClick={commit}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        Use address
      </button>
    </div>
  );
}
