"use client";

import { useEffect, useRef, useState } from "react";
import { Map } from "@vis.gl/react-google-maps";
import type { MapCameraChangedEvent } from "@vis.gl/react-google-maps";
import { AnimatePresence, motion } from "motion/react";

import {
  PrimaryButton,
  StepHeading,
  StepShell,
  ContinueBubble,
  useFlowVariant,
  useMapHeightClass,
} from "@/components/quote/ui";
import { apiUrl } from "@/lib/api";
import type { LatLng, SolarScan } from "@/lib/types";

// Just enough of a hold that the spinner doesn't flash-and-vanish on a fast
// response — kept short so the flow feels instant when the network is quick.
const MIN_PHASE_MS = 240;

type Phase = "geocoding" | "confirm" | "scanning" | "error";

export function LocateStep({
  addressLine,
  postcode,
  prefetched,
  mapView,
  onMapViewChange,
  onSuccess,
  onFallback,
  onEditAddress,
}: {
  addressLine: string;
  postcode: string;
  /** Resolved in the background as soon as the flow knew an address (see
   *  QuoteFlowBody's prefetch effect) — if it's already landed by the time
   *  this step mounts, skip the geocoding phase and go straight to confirm. */
  prefetched?: { coords: LatLng; formatted: string | null } | null;
  mapView: { center: LatLng; zoom: number } | null;
  onMapViewChange: (view: { center: LatLng; zoom: number }) => void;
  onSuccess: (coords: LatLng, formatted: string | null, scan: SolarScan) => void;
  onFallback: (coords: LatLng | null, formatted: string | null, reason: string) => void;
  onEditAddress: () => void;
}) {
  const variant = useFlowVariant();
  const startedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>(prefetched ? "confirm" : "geocoding");
  const [error, setError] = useState<string | null>(null);
  const [geocoded, setGeocoded] = useState<{
    coords: LatLng;
    formatted: string | null;
  } | null>(prefetched ?? null);
  const [centre, setCentre] = useState<LatLng | null>(
    mapView?.center ?? prefetched?.coords ?? null,
  );
  const [zoom, setZoom] = useState(mapView?.zoom ?? 19);
  const mapHeight = useMapHeightClass();

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // Already resolved before this step was reached — nothing to fetch.
    if (prefetched) return;
    const startedAt = performance.now();

    async function holdMinimum() {
      const elapsed = performance.now() - startedAt;
      if (elapsed < MIN_PHASE_MS) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, MIN_PHASE_MS - elapsed),
        );
      }
    }

    async function runGeocode() {
      try {
        const url = apiUrl("/api/geocode");
        const geocodeResponse = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: addressLine, postcode }),
        });
        const raw = await geocodeResponse.text();
        let geocodeBody: {
          coords?: LatLng;
          formattedAddress?: string;
          error?: string;
        } = {};
        try {
          geocodeBody = raw ? (JSON.parse(raw) as typeof geocodeBody) : {};
        } catch {
          throw new Error(
            `Geocode returned non-JSON (${geocodeResponse.status}) from ${url}`,
          );
        }
        await holdMinimum();
        if (!geocodeResponse.ok || !geocodeBody.coords) {
          const message =
            typeof geocodeBody.error === "string"
              ? geocodeBody.error
              : "We couldn't find that address. Double-check the house number and postcode.";
          setError(message);
          setPhase("error");
          return;
        }
        const next = {
          coords: geocodeBody.coords,
          formatted: geocodeBody.formattedAddress ?? null,
        };
        setGeocoded(next);
        setCentre(next.coords);
        onMapViewChange({ center: next.coords, zoom: 19 });
        setPhase("confirm");
      } catch (error) {
        console.error("[quoter] geocode failed", error);
        await holdMinimum();
        setError(
          "Something went wrong while finding that address. Check your connection and try again.",
        );
        setPhase("error");
      }
    }

    void runGeocode();
  }, [addressLine, postcode, prefetched]);

  async function confirmAndScan() {
    if (!geocoded || !centre) return;
    setPhase("scanning");
    const startedAt = performance.now();

    async function holdMinimum() {
      const elapsed = performance.now() - startedAt;
      if (elapsed < MIN_PHASE_MS) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, MIN_PHASE_MS - elapsed),
        );
      }
    }

    try {
      const solarResponse = await fetch(apiUrl("/api/solar"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coords: centre }),
      });
      const solarBody = (await solarResponse.json()) as {
        scan?: SolarScan;
      };
      await holdMinimum();

      if (!solarResponse.ok || !solarBody.scan) {
        onFallback(
          centre,
          geocoded.formatted,
          "Satellite measurement isn't available for this roof yet, so your roofer will price it after a quick call instead.",
        );
        return;
      }
      onSuccess(centre, geocoded.formatted, solarBody.scan);
    } catch {
      await holdMinimum();
      setError(
        "Something went wrong while measuring. Check your connection and try again.",
      );
      setPhase("error");
    }
  }

  function handleCameraChanged(event: MapCameraChangedEvent) {
    const next = event.detail.center;
    if (!next) return;
    const nextView = {
      center: { lat: next.lat, lng: next.lng },
      zoom: event.detail.zoom ?? zoom,
    };
    setCentre(nextView.center);
    setZoom(nextView.zoom);
    onMapViewChange(nextView);
  }

  if (phase === "error" || error) {
    return (
      <StepShell>
        <div className="mt-10 rounded-3xl border border-line bg-white p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="text-[15px] font-semibold text-ink">
            {error ?? "We couldn't find that address."}
          </p>
          <PrimaryButton onClick={onEditAddress}>
            Check the address
          </PrimaryButton>
        </div>
      </StepShell>
    );
  }

  if (phase === "geocoding") {
    return (
      <StepShell>
        <div className="mt-10">
          <div className="q-map--loading">
            <div className="q-spinner" />
          </div>
          <p className="mt-5 text-center text-[15px] font-semibold text-ink">
            {phase === "geocoding"
              ? "Finding your house…"
              : "Preparing your roof…"}
          </p>
          <p className="mt-1 text-center text-[13px] text-muted">{addressLine}</p>
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell bleed>
      {variant === "page" ? (
        <StepHeading sub="Drag the pin onto your roof.">
          Is this your house?
        </StepHeading>
      ) : null}

      <div
        className={`overflow-hidden rounded-3xl border border-line shadow-[var(--shadow-soft)] ${
          variant === "card" ? "absolute inset-2" : `relative ${mapHeight}`
        }`}
      >
        {centre ? (
          <Map
            center={centre}
            zoom={zoom}
            mapTypeId="satellite"
            disableDefaultUI
            zoomControl
            clickableIcons={false}
            gestureHandling="greedy"
            reuseMaps
            style={{ width: "100%", height: "100%" }}
            onCameraChanged={handleCameraChanged}
          />
        ) : null}

        {variant === "card" ? (
          <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 text-center">
            <p className="text-[17px] font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
              Is this your house?
            </p>
            <p className="mt-0.5 text-[12px] font-medium text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
              Drag the pin onto your roof.
            </p>
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {phase === "confirm" ? (
            <motion.div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.82 }}
              transition={{ duration: 0.16 }}
            >
              <div className="relative -translate-y-1/2">
                <svg width="36" height="48" viewBox="0 0 36 48" aria-hidden="true">
                  <path
                    d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z"
                    fill="#2f6bff"
                  />
                  <circle cx="18" cy="18" r="7" fill="#fff" />
                </svg>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {phase === "confirm" ? (
          <div className="absolute bottom-9 right-3 z-10">
            <ContinueBubble
              label="Continue"
              ariaLabel="Yes, measure this roof"
              onClick={() => void confirmAndScan()}
            />
          </div>
        ) : null}
      </div>
    </StepShell>
  );
}
