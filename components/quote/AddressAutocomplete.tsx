"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

import { flowInputClass } from "@/components/quote/ui";

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (formattedAddress: string, postcode: string) => void;
  /** "flow" = bordered wizard input; "bare" = transparent (lives inside the bubble's search pill). */
  variant?: "flow" | "bare";
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitText?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
};

/* Consumer-styled Google Places autocomplete (GB-restricted), adapted from
   components/dev/DeveloperLocationAutocomplete.tsx. */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  variant = "flow",
  placeholder = "Start typing your address…",
  autoFocus = false,
  onSubmitText,
  onOpenChange,
}: AddressAutocompleteProps) {
  const places = useMapsLibrary("places");
  const listId = useId();
  const skipNextLookupRef = useRef(false);
  const requestIdRef = useRef(0);
  const cacheRef = useRef(
    new Map<string, google.maps.places.PlacePrediction[]>(),
  );
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null,
  );
  // A value present on mount is a prefill (e.g. carried in from the bubble's
  // search) — don't pop the dropdown until the user actually edits it.
  const prefillRef = useRef(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<
    google.maps.places.PlacePrediction[]
  >([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dropdownBox, setDropdownBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  function setOpenState(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  function ensureSession() {
    if (!places || sessionTokenRef.current) return;
    sessionTokenRef.current = new places.AutocompleteSessionToken();
  }

  function resetSession() {
    sessionTokenRef.current = null;
  }

  useEffect(() => {
    if (!open || variant !== "bare") {
      setDropdownBox(null);
      return;
    }
    function place() {
      const anchor =
        rootRef.current?.closest(".q-search") ?? rootRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setDropdownBox({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, variant, suggestions.length]);

  useEffect(() => {
    if (skipNextLookupRef.current) {
      skipNextLookupRef.current = false;
      return;
    }
    if (value === prefillRef.current && value.trim().length > 0) return;
    const query = value.trim().replace(/\s+/g, " ");
    if (!places || query.length < 3) {
      setSuggestions([]);
      setOpenState(false);
      return;
    }

    let active = true;
    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      ensureSession();
      const cached = cacheRef.current.get(query.toLowerCase());
      const prefix = [...cacheRef.current.entries()]
        .filter(([key]) => query.toLowerCase().startsWith(key))
        .sort(([a], [b]) => b.length - a.length)[0]?.[1];
      if (cached || prefix) {
        setSuggestions((cached ?? prefix ?? []).slice(0, 4));
        setOpenState(true);
      }
      setLoading(true);
      try {
        const response =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            includedRegionCodes: ["gb"],
            region: "uk",
            language: "en-GB",
            sessionToken: sessionTokenRef.current ?? undefined,
          });
        if (!active || requestId !== requestIdRef.current) return;
        const predictions = response.suggestions.flatMap((suggestion) =>
          suggestion.placePrediction ? [suggestion.placePrediction] : [],
        );
        const cacheKey = query.toLowerCase();
        cacheRef.current.set(cacheKey, predictions);
        if (cacheRef.current.size > 20) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest) cacheRef.current.delete(oldest);
        }
        setSuggestions(predictions.slice(0, 4));
        setActiveIndex(0);
        setOpenState(predictions.length > 0);
      } catch {
        if (active) {
          setSuggestions([]);
          setOpenState(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onOpenChange is a stable callback from parent
  }, [places, value]);

  async function selectPrediction(
    prediction: google.maps.places.PlacePrediction,
  ) {
    setOpenState(false);
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
      onSelect(place.formattedAddress ?? prediction.text.toString(), postcode);
    } catch {
      onSelect(prediction.text.toString(), "");
    } finally {
      resetSession();
    }
  }

  const list = open && (suggestions.length > 0 || loading) ? (
    <motion.div
      id={listId}
      role="listbox"
      className="q-suggestions"
      style={
        dropdownBox
          ? {
              position: "fixed",
              top: dropdownBox.top,
              left: dropdownBox.left,
              width: dropdownBox.width,
              right: "auto",
            }
          : undefined
      }
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
    >
      {suggestions.map((prediction, index) => (
        <button
          key={prediction.placeId}
          type="button"
          role="option"
          aria-selected={activeIndex === index}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => selectPrediction(prediction)}
          onMouseEnter={() => setActiveIndex(index)}
          className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${
            activeIndex === index ? "bg-brand-50" : "hover:bg-brand-50"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mt-0.5 size-4 flex-none text-brand-500"
            aria-hidden="true"
          >
            <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span className="min-w-0">
            <span
              className={`block truncate font-semibold text-ink ${
                variant === "flow" ? "text-[15px]" : "text-[14px]"
              }`}
            >
              {prediction.mainText?.toString() ?? prediction.text.toString()}
            </span>
            {prediction.secondaryText ? (
              <span
                className={`mt-0.5 block truncate text-muted ${
                  variant === "flow" ? "text-[13px]" : "text-[12px]"
                }`}
              >
                {prediction.secondaryText.toString()}
              </span>
            ) : null}
          </span>
        </button>
      ))}
      {loading && suggestions.length === 0 ? (
        <div className="space-y-2 px-3 py-2.5" aria-label="Loading address suggestions">
          <span className="block h-3 w-2/5 animate-pulse rounded bg-brand-50" />
          <span className="block h-2.5 w-3/5 animate-pulse rounded bg-[#f1f2f5]" />
        </div>
      ) : null}
      <p className="px-3 py-1.5 text-right text-[10px] font-semibold text-muted/70">
        Powered by Google
      </p>
    </motion.div>
  ) : null;

  return (
    <div ref={rootRef} className={`relative ${variant === "bare" ? "z-20" : ""}`}>
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onFocus={() => {
          ensureSession();
          if (suggestions.length > 0) setOpenState(true);
        }}
        onBlur={() => window.setTimeout(() => setOpenState(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpenState(false);
            return;
          }
          if (event.key === "ArrowDown" && suggestions.length > 0) {
            event.preventDefault();
            setActiveIndex(Math.min(suggestions.length - 1, activeIndex + 1));
            return;
          }
          if (event.key === "ArrowUp" && suggestions.length > 0) {
            event.preventDefault();
            setActiveIndex(Math.max(0, activeIndex - 1));
            return;
          }
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (open && suggestions.length > 0) {
            void selectPrediction(suggestions[Math.max(0, activeIndex)]);
          } else {
            onSubmitText?.(value);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-label="Your address"
        className={variant === "flow" ? flowInputClass : undefined}
      />
      {loading && variant === "flow" ? (
        <span className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-brand-400 border-r-transparent" />
      ) : null}

      {/* AnimatePresence drops portal children (portals fail isValidElement),
          so the portal must wrap the presence boundary — not the reverse. */}
      {variant === "bare" && typeof document !== "undefined" ? (
        createPortal(<AnimatePresence>{list}</AnimatePresence>, document.body)
      ) : (
        <AnimatePresence>{list}</AnimatePresence>
      )}
    </div>
  );
}
