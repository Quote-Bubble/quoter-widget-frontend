"use client";

import { useMemo, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";

import { DeveloperLocationAutocomplete } from "@/components/dev/DeveloperLocationAutocomplete";
import { DeveloperRoofMap } from "@/components/dev/DeveloperRoofMap";
import { PRICE_LIST, REPAIR_SIZE_BANDS } from "@/config/rates";
import { apiUrl } from "@/lib/api";
import {
  isImageryOlderThanThreeYears,
  measureBoundary,
  pathFromBounds,
  selectBoundsShare,
} from "@/lib/roof-geometry";
import { measureRoofLines } from "@/lib/roof-lines";
import {
  calculateRepairEstimate,
  calculateReplacementEstimate,
  repairSizeAdjustment,
} from "@/lib/quote";
import type {
  ConditionAnswer,
  LatLng,
  Material,
  PricingMode,
  RepairMaterial,
  ReplacementMaterial,
  RoofMeasurement,
  RoofType,
  SolarScan,
} from "@/lib/types";

type DebugEnvelope = {
  request?: unknown;
  rawResponse?: unknown;
};

type GeocodeResponse = {
  coords?: LatLng;
  formattedAddress?: string;
  placeId?: string;
  debug?: DebugEnvelope;
  error?: string;
  code?: string;
};

type SolarResponse = {
  scan?: SolarScan;
  debug?: DebugEnvelope;
  error?: string;
  code?: string;
};

type DataTab =
  | "calculation"
  | "inputs"
  | "normalized"
  | "raw-solar"
  | "raw-geocode"
  | "roof-lines"
  | "price-list"
  | "quote";

const REPLACEMENT_MATERIALS: Array<{
  value: ReplacementMaterial;
  label: string;
}> = [
  { value: "not_sure", label: "Not sure" },
  { value: "concrete_tile", label: "Concrete tile" },
  { value: "clay_tile", label: "Clay tile" },
  { value: "natural_slate", label: "Natural slate" },
  { value: "flat_bitumen", label: "Flat: bitumen" },
  { value: "flat_epdm", label: "Flat: EPDM" },
  { value: "flat_grp", label: "Flat: GRP" },
];

const REPAIR_MATERIALS: Array<{ value: RepairMaterial; label: string }> = [
  ...REPLACEMENT_MATERIALS,
  { value: "fibre_cement", label: "Fibre cement tile" },
  { value: "polycarbonate", label: "Polycarbonate" },
  { value: "glass_plain", label: "6mm plain glass" },
  { value: "glass_laminated", label: "6.4mm laminated glass" },
  { value: "felt", label: "Felt" },
];

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15";
const panelClass =
  "rounded-lg border border-slate-800 bg-slate-900/80 shadow-sm";
const labelClass =
  "block text-[11px] font-bold uppercase tracking-wider text-slate-400";

export function RoofMeasurementLab() {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  if (!mapsApiKey) return <RoofMeasurementLabShell mapsEnabled={false} />;

  return (
    <APIProvider
      apiKey={mapsApiKey}
      region="GB"
      language="en-GB"
      solutionChannel="roof-measurement-dev-lab"
    >
      <RoofMeasurementLabShell mapsEnabled />
    </APIProvider>
  );
}

function RoofMeasurementLabShell({
  mapsEnabled,
}: {
  mapsEnabled: boolean;
}) {
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [geocodeResponse, setGeocodeResponse] =
    useState<GeocodeResponse | null>(null);
  const [solarResponse, setSolarResponse] = useState<SolarResponse | null>(null);
  const [scan, setScan] = useState<SolarScan | null>(null);
  const [selection, setSelection] = useState<LatLng[]>([]);
  const [selectionLabel, setSelectionLabel] = useState("Not set");
  const [mapVersion, setMapVersion] = useState(0);
  const [showSegmentBounds, setShowSegmentBounds] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [geocodeMs, setGeocodeMs] = useState<number | null>(null);
  const [solarMs, setSolarMs] = useState<number | null>(null);
  const [tab, setTab] = useState<DataTab>("calculation");

  const [storeys, setStoreys] = useState(2);
  const [shareCount, setShareCount] = useState(2);
  const [shareIndex, setShareIndex] = useState(0);
  const [pricingMode, setPricingMode] =
    useState<PricingMode>("replacement");
  const [material, setMaterial] = useState<Material>("not_sure");
  const [condition, setCondition] =
    useState<ConditionAnswer>("not_sure");
  const [scaffoldWeeks, setScaffoldWeeks] = useState(1);
  const [includeSkip, setIncludeSkip] = useState(true);
  const [repairAreaM2, setRepairAreaM2] = useState(3);
  const [useSelectedRepairArea, setUseSelectedRepairArea] = useState(false);
  const [includeExperimentalLines, setIncludeExperimentalLines] =
    useState(false);
  const [roofTypeOverride, setRoofTypeOverride] = useState<
    RoofType | "derived"
  >("derived");

  const measurement = useMemo(() => {
    if (!scan || selection.length < 3) return null;
    try {
      return measureBoundary(scan, selection);
    } catch {
      return null;
    }
  }, [scan, selection]);

  const fullSelectionMeasurement = useMemo(() => {
    if (!scan) return null;
    try {
      return measureBoundary(scan, pathFromBounds(scan.boundingBox));
    } catch {
      return null;
    }
  }, [scan]);

  const roofLines = useMemo(
    () =>
      scan
        ? measureRoofLines(scan, selection.length >= 3 ? selection : undefined)
        : null,
    [scan, selection],
  );
  const activeRepairAreaM2 =
    useSelectedRepairArea && measurement
      ? measurement.surfaceAreaM2
      : repairAreaM2;
  const repairAdjustment = repairSizeAdjustment(activeRepairAreaM2);

  const quote = useMemo(() => {
    if (!scan || !measurement) return null;
    const linearItems = includeExperimentalLines && roofLines
      ? [
          {
            rateId: "dry_ridge_m" as const,
            quantityM: roofLines.totals.ridge,
          },
          {
            rateId: "dry_hip_m" as const,
            quantityM: roofLines.totals.hip,
          },
          {
            rateId: "grp_valley_m" as const,
            quantityM: roofLines.totals.valley,
          },
        ]
      : [];

    if (pricingMode === "repair") {
      return calculateRepairEstimate({
        areaM2: useSelectedRepairArea
          ? measurement.surfaceAreaM2
          : repairAreaM2,
        material: material as RepairMaterial,
        storeys,
        scaffoldWeeks,
        includeSkip,
        conditionAnswer: condition,
        linearItems,
      });
    }

    return calculateReplacementEstimate({
      areaM2: measurement.surfaceAreaM2,
      roofType:
        roofTypeOverride === "derived"
          ? measurement.roofType
          : roofTypeOverride,
      material: material as ReplacementMaterial,
      storeys,
      scaffoldWeeks,
      includeSkip,
      imageryQuality: scan.imageryQuality,
      imageryDateIsOld: isImageryOlderThanThreeYears(scan.imageryDate),
      polygonWasEdited: selectionLabel === "Custom polygon",
      conditionAnswer: condition,
      linearItems,
    });
  }, [
    condition,
    includeExperimentalLines,
    includeSkip,
    material,
    measurement,
    pricingMode,
    repairAreaM2,
    roofTypeOverride,
    roofLines,
    scan,
    scaffoldWeeks,
    selectionLabel,
    storeys,
    useSelectedRepairArea,
  ]);

  const effectiveInputs = useMemo(
    () => ({
      address: {
        input: address,
        postcode,
        geocoded: geocodeResponse?.formattedAddress ?? null,
        coords: geocodeResponse?.coords ?? null,
        placeId: geocodeResponse?.placeId ?? null,
      },
      buildingContext: {
        storeys,
        wholeRoofGroundAreaM2: scan?.wholeRoofStats.groundAreaMeters2 ?? null,
      },
      selection: {
        label: selectionLabel,
        vertices: selection,
      },
      pricing: {
        mode: pricingMode,
        material,
        condition,
        scaffoldWeeks,
        includeSkip,
        repairAreaM2:
          pricingMode === "repair"
            ? useSelectedRepairArea
              ? measurement?.surfaceAreaM2 ?? null
              : repairAreaM2
            : null,
        includeExperimentalLines,
        roofType:
          roofTypeOverride === "derived"
            ? measurement?.roofType ?? null
            : roofTypeOverride,
        measuredSurfaceAreaM2: measurement?.surfaceAreaM2 ?? null,
      },
      roofLines,
    }),
    [
      address,
      condition,
      geocodeResponse,
      includeExperimentalLines,
      includeSkip,
      material,
      measurement,
      postcode,
      pricingMode,
      repairAreaM2,
      roofTypeOverride,
      roofLines,
      scan,
      scaffoldWeeks,
      selection,
      selectionLabel,
      storeys,
      useSelectedRepairArea,
    ],
  );

  const warnings = useMemo(() => {
    const result: string[] = [];
    if (!scan || !measurement) return result;
    if (scan.imageryQuality.toUpperCase() !== "HIGH") {
      result.push(`Imagery quality is ${scan.imageryQuality}, not HIGH.`);
    }
    if (isImageryOlderThanThreeYears(scan.imageryDate)) {
      result.push("Imagery is missing a date or is older than three years.");
    }
    if (measurement.surfaceCalibrationFactor < 0.9 ||
        measurement.surfaceCalibrationFactor > 1.1) {
      result.push(
        `Segment pitch model needed a ${measurement.surfaceCalibrationFactor.toFixed(
          3,
        )}× reconciliation to match Google's whole-roof surface area.`,
      );
    }
    if (
      fullSelectionMeasurement &&
      measurement.surfaceAreaM2 >
        fullSelectionMeasurement.surfaceAreaM2 * 1.001
    ) {
      result.push("Selected area exceeds the whole-roof reference.");
    }
    result.push(
      "Segment footprints are rectangular bounding-box approximations; independent survey geometry is required to establish real-world absolute accuracy.",
    );
    if (roofLines?.features.length) result.push(roofLines.warning);
    return result;
  }, [fullSelectionMeasurement, measurement, roofLines, scan]);

  function applySelection(path: LatLng[], label: string) {
    setSelection(path);
    setSelectionLabel(label);
    setMapVersion((value) => value + 1);
  }

  async function runScan() {
    setLoading(true);
    setError("");
    setScan(null);
    setSelection([]);
    setSolarResponse(null);

    try {
      const geocodeStart = performance.now();
      const geocodeRequest = await fetch(apiUrl("/api/geocode"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, postcode }),
      });
      const nextGeocode = (await geocodeRequest.json()) as GeocodeResponse;
      setGeocodeMs(performance.now() - geocodeStart);
      setGeocodeResponse(nextGeocode);

      if (!geocodeRequest.ok || !nextGeocode.coords) {
        throw new Error(nextGeocode.error ?? "Geocoding failed.");
      }

      const solarStart = performance.now();
      const solarRequest = await fetch(apiUrl("/api/solar"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coords: nextGeocode.coords }),
      });
      const nextSolar = (await solarRequest.json()) as SolarResponse;
      setSolarMs(performance.now() - solarStart);
      setSolarResponse(nextSolar);

      if (!solarRequest.ok || !nextSolar.scan) {
        throw new Error(nextSolar.error ?? "Solar lookup failed.");
      }

      setScan(nextSolar.scan);
      applySelection(
        pathFromBounds(nextSolar.scan.boundingBox),
        "Whole building bbox",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  function applyBoundsShare(count: number, index: number) {
    if (!scan) return;
    const safeIndex = Math.max(0, Math.min(count - 1, index));
    setShareCount(count);
    setShareIndex(safeIndex);
    applySelection(
      selectBoundsShare(scan.boundingBox, count, safeIndex),
      `${count}-way bbox share ${safeIndex + 1}/${count}`,
    );
  }

  return (
    <main className="min-h-screen bg-[#070b12] text-slate-200">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-5 py-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] font-bold text-cyan-300">
                DEV ONLY
              </span>
              <h1 className="text-lg font-bold text-white">
                Roof Measurement Workbench
              </h1>
            </div>
            <p className="mt-1 font-mono text-xs text-slate-500">
              Inspect API inputs, source data, geometry, formulae and pricing.
            </p>
          </div>
          <div className="text-right font-mono text-[11px]">
            <p className="text-emerald-400">● local environment</p>
            <p className="mt-1 text-slate-500">
              Maps {mapsEnabled ? "loaded" : "key missing"}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1800px] gap-4 p-4 min-[900px]:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className={`${panelClass} p-4`}>
            <SectionTitle index="01" title="Property request" />
            <label className={`${labelClass} mt-4`} htmlFor="dev-location">
              Address or postcode
            </label>
            <DeveloperLocationAutocomplete
              value={address}
              disabled={!mapsEnabled}
              onChange={(value) => {
                setAddress(value);
                setPostcode("");
                setGeocodeResponse(null);
                setSolarResponse(null);
                setScan(null);
                setSelection([]);
              }}
              onSelect={(formattedAddress, selectedPostcode) => {
                setAddress(formattedAddress);
                setPostcode(selectedPostcode.toUpperCase());
                setError(
                  selectedPostcode
                    ? ""
                    : "Google did not return a postcode for this result.",
                );
              }}
            />
            <p
              className={`mt-2 font-mono text-[11px] ${
                postcode ? "text-emerald-400" : "text-slate-500"
              }`}
            >
              {postcode
                ? `✓ Google selection resolved postcode ${postcode}`
                : "Type at least 3 characters, then select a Google result."}
            </p>

            <button
              type="button"
              onClick={runScan}
              disabled={loading || !address.trim() || !postcode.trim()}
              className="mt-4 w-full rounded-md bg-cyan-500 px-4 py-3 text-sm font-extrabold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Calling Google APIs…" : "Geocode + fetch Solar data"}
            </button>

            {error ? (
              <p className="mt-3 rounded border border-red-900 bg-red-950/60 p-2 text-xs text-red-300">
                {error}
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px]">
              <StatusCell
                label="Geocoding"
                value={
                  geocodeMs === null ? "not run" : `${geocodeMs.toFixed(0)}ms`
                }
                ready={Boolean(geocodeResponse?.coords)}
              />
              <StatusCell
                label="Solar"
                value={solarMs === null ? "not run" : `${solarMs.toFixed(0)}ms`}
                ready={Boolean(scan)}
              />
            </div>
          </section>

          <section className={`${panelClass} p-4`}>
            <SectionTitle index="02" title="Pricing inputs" />
            <label className={`${labelClass} mt-4`}>
              Estimate mode
              <select
                className={inputClass}
                value={pricingMode}
                onChange={(event) => {
                  setPricingMode(event.target.value as PricingMode);
                  setMaterial("not_sure");
                }}
              >
                <option value="replacement">Full replacement</option>
                <option value="repair">Repair area</option>
              </select>
            </label>

            {pricingMode === "replacement" ? (
              <label className={`${labelClass} mt-4`}>
                Roof type
                <select
                  className={inputClass}
                  value={roofTypeOverride}
                  onChange={(event) =>
                    setRoofTypeOverride(
                      event.target.value as RoofType | "derived",
                    )
                  }
                >
                  <option value="derived">Derived from segments</option>
                  <option value="gable">Force gable</option>
                  <option value="hip">Force hip</option>
                  <option value="flat">Force flat</option>
                </select>
              </label>
            ) : null}

            <label className={`${labelClass} mt-4`}>
              Material
              <select
                className={inputClass}
                value={material}
                onChange={(event) =>
                  setMaterial(event.target.value as Material)
                }
              >
                {(pricingMode === "replacement"
                  ? REPLACEMENT_MATERIALS
                  : REPAIR_MATERIALS
                ).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {pricingMode === "repair" ? (
              <div className="mt-4 rounded border border-slate-800 bg-slate-950/60 p-3">
                <label className="flex items-start gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={useSelectedRepairArea}
                    onChange={(event) =>
                      setUseSelectedRepairArea(event.target.checked)
                    }
                    className="mt-0.5 accent-cyan-400"
                  />
                  Use selected satellite surface as affected repair area
                </label>
                <label className={`${labelClass} mt-3`}>
                  Affected area, m²
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    disabled={useSelectedRepairArea}
                    value={Number(activeRepairAreaM2.toFixed(2))}
                    onChange={(event) =>
                      setRepairAreaM2(
                        Math.max(0.1, Number(event.target.value) || 0.1),
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <p className="mt-2 font-mono text-[10px] leading-4 text-amber-300">
                  {repairAdjustment.label}:{" "}
                  {repairAdjustment.rateMultiplier.toFixed(2)}× published rate.
                  This decay band is an explicit internal assumption.
                </p>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className={labelClass}>
                Storeys
                <select
                  className={inputClass}
                  value={storeys}
                  onChange={(event) => setStoreys(Number(event.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3+</option>
                </select>
              </label>
              <label className={labelClass}>
                Scaffold weeks
                <input
                  type="number"
                  min={0}
                  max={12}
                  step={1}
                  value={scaffoldWeeks}
                  onChange={(event) =>
                    setScaffoldWeeks(
                      Math.max(0, Number(event.target.value) || 0),
                    )
                  }
                  className={inputClass}
                />
              </label>
            </div>

            <label className={`${labelClass} mt-4`}>
              Condition
              <select
                className={inputClass}
                value={condition}
                onChange={(event) =>
                  setCondition(event.target.value as ConditionAnswer)
                }
              >
                <option value="not_sure">Not sure</option>
                <option value="no">No issue</option>
                <option value="yes">Issue flagged</option>
              </select>
            </label>

            <div className="mt-4 space-y-2 rounded border border-slate-800 bg-slate-950/60 p-3">
              <label className="flex items-start gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includeSkip}
                  onChange={(event) => setIncludeSkip(event.target.checked)}
                  className="mt-0.5 accent-cyan-400"
                />
                Include skip hire (£125–£320 sourced range)
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includeExperimentalLines}
                  onChange={(event) =>
                    setIncludeExperimentalLines(event.target.checked)
                  }
                  className="mt-0.5 accent-amber-400"
                />
                Include experimental ridge/hip/valley lengths in estimate
              </label>
            </div>
          </section>
        </aside>

        <div className="min-w-0 space-y-4">
          <section className={`${panelClass} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle index="03" title="Geometry inspection" />
              {scan ? (
                <div className="flex flex-wrap gap-2">
                  <DevButton
                    onClick={() =>
                      applySelection(
                        pathFromBounds(scan.boundingBox),
                        "Whole building bbox",
                      )
                    }
                  >
                    Whole bbox
                  </DevButton>
                  <DevButton onClick={() => applyBoundsShare(2, 0)}>
                    Half 1/2
                  </DevButton>
                  <DevButton onClick={() => applyBoundsShare(2, 1)}>
                    Half 2/2
                  </DevButton>
                  <select
                    aria-label="Share count"
                    value={shareCount}
                    onChange={(event) => {
                      const count = Number(event.target.value);
                      setShareCount(count);
                      setShareIndex((current) =>
                        Math.min(current, count - 1),
                      );
                    }}
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-300"
                  >
                    {[2, 3, 4, 5, 6, 8, 10, 12].map((count) => (
                      <option key={count} value={count}>
                        {count} shares
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Share index"
                    value={shareIndex}
                    onChange={(event) =>
                      setShareIndex(Number(event.target.value))
                    }
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-300"
                  >
                    {Array.from({ length: shareCount }, (_, index) => (
                      <option key={index} value={index}>
                        share {index + 1}
                      </option>
                    ))}
                  </select>
                  <DevButton
                    onClick={() => applyBoundsShare(shareCount, shareIndex)}
                  >
                    Apply share
                  </DevButton>
                  <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                    <input
                      type="checkbox"
                      checked={showSegmentBounds}
                      onChange={(event) =>
                        setShowSegmentBounds(event.target.checked)
                      }
                      className="accent-cyan-400"
                    />
                    Segment bboxes
                  </label>
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              {scan && selection.length >= 3 && mapsEnabled ? (
                <DeveloperRoofMap
                  key={mapVersion}
                  buildingBounds={scan.boundingBox}
                  segments={scan.roofSegmentStats}
                  selection={selection}
                  roofLines={roofLines}
                  showSegmentBounds={showSegmentBounds}
                  onSelectionChange={(path) => {
                    setSelection(path);
                    setSelectionLabel("Custom polygon");
                  }}
                />
              ) : (
                <div className="flex h-[560px] items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950 text-center font-mono text-sm text-slate-500">
                  {mapsEnabled
                    ? "Run a property request to inspect geometry."
                    : "Browser Maps key is missing."}
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Selected surface"
              value={
                measurement
                  ? `${measurement.surfaceAreaM2.toFixed(2)}m²`
                  : "—"
              }
              detail={selectionLabel}
              accent
            />
            <MetricCard
              label="Whole roof reference"
              value={
                scan ? `${scan.wholeRoofStats.areaMeters2.toFixed(2)}m²` : "—"
              }
              detail="Google wholeRoofStats.areaMeters2"
            />
            <MetricCard
              label="Selection coverage"
              value={
                measurement && fullSelectionMeasurement
                  ? `${(
                      (measurement.surfaceAreaM2 /
                        fullSelectionMeasurement.surfaceAreaM2) *
                      100
                    ).toFixed(1)}%`
                  : "—"
              }
              detail="Selected ÷ full bbox result"
            />
            <MetricCard
              label="Quote pricing area"
              value={
                quote?.pricingAreaM2
                  ? `${quote.pricingAreaM2.toFixed(2)}m²`
                  : "—"
              }
              detail={
                pricingMode === "repair" && !useSelectedRepairArea
                  ? "Manual affected repair area"
                  : quote && measurement &&
                Math.abs(
                  (quote.pricingAreaM2 ?? 0) - measurement.surfaceAreaM2,
                ) < 0.001
                  ? "✓ matches selected surface"
                  : "Awaiting calculation"
              }
            />
          </section>

          {measurement ? (
            <section className={`${panelClass} grid gap-3 p-4 md:grid-cols-3`}>
              <KeyValue
                label="selected ground area"
                value={`${measurement.groundAreaM2.toFixed(3)}m²`}
              />
              <KeyValue
                label="weighted pitch"
                value={`${measurement.averagePitchDegrees.toFixed(2)}°`}
              />
              <KeyValue label="derived roof type" value={measurement.roofType} />
              <KeyValue
                label="intersected segments"
                value={String(measurement.intersectedSegments)}
              />
              <KeyValue
                label="surface calibration"
                value={`${measurement.surfaceCalibrationFactor.toFixed(5)}×`}
              />
              <KeyValue
                label="quote ex VAT"
                value={
                  quote
                    ? `£${quote.min.toLocaleString()}–£${quote.max.toLocaleString()}`
                    : "—"
                }
              />
            </section>
          ) : null}

          {roofLines ? (
            <section className={`${panelClass} p-4`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Experimental roof-line measurements
                  </h2>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                    Solar plane intersection clipped to overlapping segment
                    bboxes
                  </p>
                </div>
                <span className="rounded border border-amber-800 bg-amber-950/50 px-2 py-1 font-mono text-[10px] text-amber-300">
                  NOT SURVEYED
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {(
                  [
                    ["Ridge", roofLines.totals.ridge, "text-emerald-300"],
                    ["Hip", roofLines.totals.hip, "text-orange-300"],
                    ["Valley", roofLines.totals.valley, "text-sky-300"],
                    [
                      "Unresolved",
                      roofLines.totals.unresolved,
                      "text-slate-300",
                    ],
                  ] as const
                ).map(([label, value, colour]) => (
                  <div
                    key={label}
                    className="rounded border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <p className="font-mono text-[10px] uppercase text-slate-500">
                      {label}
                    </p>
                    <p className={`mt-1 text-xl font-black ${colour}`}>
                      {value.toFixed(2)}m
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-amber-200/70">
                {roofLines.warning}
              </p>
            </section>
          ) : null}

          {warnings.length ? (
            <section className="rounded-lg border border-amber-900/80 bg-amber-950/25 p-4">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
                Accuracy notes / warnings
              </h2>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-100/80">
                {warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={panelClass}>
            <div className="flex overflow-x-auto border-b border-slate-800 px-2 pt-2">
              {(
                [
                  ["calculation", "Calculation trace"],
                  ["inputs", "Effective inputs"],
                  ["normalized", "Normalized Solar"],
                  ["roof-lines", "Roof lines"],
                  ["price-list", "Price list"],
                  ["raw-solar", "Raw Solar"],
                  ["raw-geocode", "Raw Geocode"],
                  ["quote", "Quote output"],
                ] as Array<[DataTab, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`shrink-0 border-b-2 px-3 py-2.5 font-mono text-xs ${
                    tab === value
                      ? "border-cyan-400 text-cyan-300"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-80">
              {tab === "calculation" ? (
                <CalculationTrace measurement={measurement} />
              ) : null}
              {tab === "inputs" ? (
                <JsonPanel value={effectiveInputs} />
              ) : null}
              {tab === "normalized" ? <JsonPanel value={scan} /> : null}
              {tab === "roof-lines" ? (
                <JsonPanel value={roofLines} />
              ) : null}
              {tab === "price-list" ? (
                <JsonPanel
                  value={{
                    rates: PRICE_LIST,
                    repairSizeBands: REPAIR_SIZE_BANDS,
                  }}
                />
              ) : null}
              {tab === "raw-solar" ? (
                <JsonPanel value={solarResponse?.debug ?? solarResponse} />
              ) : null}
              {tab === "raw-geocode" ? (
                <JsonPanel value={geocodeResponse?.debug ?? geocodeResponse} />
              ) : null}
              {tab === "quote" ? <JsonPanel value={quote} /> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function CalculationTrace({
  measurement,
}: {
  measurement: RoofMeasurement | null;
}) {
  if (!measurement) {
    return (
      <p className="p-5 font-mono text-sm text-slate-500">
        No measurement yet.
      </p>
    );
  }

  return (
    <div>
      <div className="border-b border-slate-800 bg-slate-950/50 p-4 font-mono text-xs leading-6 text-slate-300">
        <p>
          overlapRatio = turfArea(intersect(segmentBBox, selection)) ÷
          turfArea(segmentBBox)
        </p>
        <p>
          selectedSurface = Solar segment groundArea × overlapRatio ×
          (1 ÷ cos(pitch)) × {measurement.surfaceCalibrationFactor.toFixed(5)}
        </p>
        <p>
          total = Σ selectedSurface ={" "}
          <strong className="text-cyan-300">
            {measurement.surfaceAreaM2.toFixed(3)}m²
          </strong>
        </p>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[1050px] border-collapse font-mono text-[11px]">
          <thead className="sticky top-0 bg-slate-900 text-left text-slate-400">
            <tr>
              {[
                "segment",
                "pitch",
                "azimuth",
                "bbox m²",
                "intersection m²",
                "overlap",
                "Solar ground m²",
                "selected ground m²",
                "pitch factor",
                "surface m²",
              ].map((heading) => (
                <th
                  key={heading}
                  className="border-b border-slate-700 px-3 py-2"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {measurement.contributions.map((item) => (
              <tr
                key={item.segmentIndex}
                className="border-b border-slate-800/80 text-slate-300 hover:bg-slate-800/40"
              >
                <td className="px-3 py-2">{item.segmentIndex}</td>
                <td className="px-3 py-2">{item.pitchDegrees.toFixed(1)}°</td>
                <td className="px-3 py-2">{item.azimuthDegrees.toFixed(1)}°</td>
                <td className="px-3 py-2">{item.bboxAreaM2.toFixed(2)}</td>
                <td className="px-3 py-2">
                  {item.polygonIntersectionAreaM2.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  {(item.overlapRatio * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2">
                  {(
                    item.selectedGroundAreaM2 / item.overlapRatio
                  ).toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  {item.selectedGroundAreaM2.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  {item.pitchMultiplier.toFixed(4)}
                </td>
                <td className="px-3 py-2 font-bold text-cyan-300">
                  {item.selectedSurfaceAreaM2.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-950 font-bold text-white">
            <tr>
              <td className="px-3 py-3" colSpan={7}>
                TOTAL
              </td>
              <td className="px-3 py-3">
                {measurement.groundAreaM2.toFixed(2)}
              </td>
              <td className="px-3 py-3" />
              <td className="px-3 py-3 text-cyan-300">
                {measurement.surfaceAreaM2.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function JsonPanel({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[620px] overflow-auto p-4 font-mono text-[11px] leading-5 text-emerald-300">
      {value
        ? JSON.stringify(value, null, 2)
        : "// No data. Run a property request first."}
    </pre>
  );
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold text-white">
      <span className="font-mono text-[10px] text-cyan-400">{index}</span>
      {title}
    </h2>
  );
}

function StatusCell({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-2">
      <p className="text-slate-500">{label}</p>
      <p className={ready ? "mt-1 text-emerald-400" : "mt-1 text-slate-400"}>
        {ready ? "✓ " : "○ "}
        {value}
      </p>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-bold text-slate-200">{value}</dd>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? "border-cyan-700 bg-cyan-950/30"
          : "border-slate-800 bg-slate-900/80"
      }`}
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-black ${
          accent ? "text-cyan-300" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 truncate font-mono text-[10px] text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function DevButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-600 hover:text-cyan-300"
    >
      {children}
    </button>
  );
}
