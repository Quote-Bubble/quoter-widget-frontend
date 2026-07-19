"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

type DeveloperLocationAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (formattedAddress: string, postcode: string) => void;
  disabled?: boolean;
};

export function DeveloperLocationAutocomplete({
  value,
  onChange,
  onSelect,
  disabled = false,
}: DeveloperLocationAutocompleteProps) {
  const places = useMapsLibrary("places");
  const listId = useId();
  const skipNextLookupRef = useRef(false);
  const [suggestions, setSuggestions] = useState<
    google.maps.places.PlacePrediction[]
  >([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (skipNextLookupRef.current) {
      skipNextLookupRef.current = false;
      return;
    }
    const query = value.trim();
    if (!places || query.length < 3) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            includedRegionCodes: ["gb"],
            region: "uk",
            language: "en-GB",
          });
        if (!active) return;

        const predictions = response.suggestions.flatMap((suggestion) =>
          suggestion.placePrediction ? [suggestion.placePrediction] : [],
        );
        setSuggestions(predictions.slice(0, 6));
        setOpen(predictions.length > 0);
      } catch {
        if (active) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [places, value]);

  async function selectPrediction(
    prediction: google.maps.places.PlacePrediction,
  ) {
    setOpen(false);
    setSuggestions([]);
    skipNextLookupRef.current = true;

    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ["formattedAddress", "addressComponents"],
      });
      const postcode =
        place.addressComponents?.find((component) =>
          component.types.includes("postal_code"),
        )?.longText ?? "";
      onSelect(
        place.formattedAddress ?? prediction.text.toString(),
        postcode,
      );
    } catch {
      onSelect(prediction.text.toString(), "");
    }
  }

  return (
    <div className="relative mt-1.5">
      <div className="relative">
        <input
          id="dev-location"
          type="text"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
            setSuggestions([]);
            setOpen(false);
          }}
          onFocus={() => setOpen(suggestions.length > 0)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Start typing an address or postcode…"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-3 pr-10 text-sm text-slate-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 disabled:opacity-50"
        />
        {loading ? (
          <span className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-cyan-400 border-r-transparent" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          >
            <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        )}
      </div>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-950 p-1 shadow-2xl"
        >
          {suggestions.map((prediction) => (
            <button
              key={prediction.placeId}
              type="button"
              role="option"
              aria-selected="false"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectPrediction(prediction)}
              className="flex w-full items-start gap-3 rounded px-3 py-2.5 text-left hover:bg-slate-800"
            >
              <span className="mt-0.5 text-cyan-400">⌖</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-100">
                  {prediction.mainText?.toString() ??
                    prediction.text.toString()}
                </span>
                {prediction.secondaryText ? (
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {prediction.secondaryText.toString()}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
          <p className="px-3 py-1.5 text-right text-[10px] font-semibold text-slate-600">
            Powered by Google
          </p>
        </div>
      ) : null}
    </div>
  );
}
