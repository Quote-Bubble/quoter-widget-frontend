"use client";

import { useEffect, useMemo, useState } from "react";
import { Map, useMap } from "@vis.gl/react-google-maps";

import type { LatLng } from "@/lib/types";
import { useFlowVariant } from "@/components/quote/ui";

const VIEW_W = 340;
const VIEW_H = 210;

function projectPathToViewBox(
  path: LatLng[],
  bounds: { north: number; south: number; east: number; west: number },
): string {
  const spanLng = Math.max(bounds.east - bounds.west, 1e-9);
  const spanLat = Math.max(bounds.north - bounds.south, 1e-9);
  return path
    .map((point) => {
      const x = ((point.lng - bounds.west) / spanLng) * VIEW_W;
      const y = ((bounds.north - point.lat) / spanLat) * VIEW_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function padBounds(paths: LatLng[][], padFraction = 0.35) {
  const lats = paths.flatMap((path) => path.map((p) => p.lat));
  const lngs = paths.flatMap((path) => path.map((p) => p.lng));
  const north = Math.max(...lats);
  const south = Math.min(...lats);
  const east = Math.max(...lngs);
  const west = Math.min(...lngs);
  const latPad = Math.max((north - south) * padFraction, 0.00008);
  const lngPad = Math.max((east - west) * padFraction, 0.00008);
  return {
    north: north + latPad,
    south: south - latPad,
    east: east + lngPad,
    west: west - lngPad,
  };
}

function roofsToSvgPolygons(roofs: LatLng[][]): string[] {
  const all = roofs.filter((path) => path.length >= 3);
  if (all.length === 0) return [];
  const lats = all.flatMap((path) => path.map((p) => p.lat));
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cos = Math.cos((midLat * Math.PI) / 180);
  const xs = all.map((path) => path.map((point) => point.lng * cos));
  const minX = Math.min(...xs.flat());
  const maxX = Math.max(...xs.flat());
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);
  const pad = 42;
  const scale = Math.min(
    (VIEW_W - pad * 2) / spanX,
    (VIEW_H - pad * 2) / spanY,
  );
  const offsetX = (VIEW_W - spanX * scale) / 2;
  const offsetY = (VIEW_H - spanY * scale) / 2;

  return all.map((path, roofIndex) =>
    path
      .map((point, index) => {
        const x = (xs[roofIndex][index] - minX) * scale + offsetX;
        const y = (maxLat - point.lat) * scale + offsetY;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" "),
  );
}

function RoofOverlay({
  roofs,
}: {
  roofs: LatLng[][];
}) {
  const map = useMap();
  const [polygons, setPolygons] = useState<string[]>([]);

  useEffect(() => {
    if (!map || roofs.length === 0) return;

    const project = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const box = {
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng(),
      };
      setPolygons(
        roofs
          .filter((path) => path.length >= 3)
          .map((path) => projectPathToViewBox(path, box)),
      );
    };

    const listener = map.addListener("idle", project);
    project();
    return () => {
      listener.remove();
    };
  }, [map, roofs]);

  if (polygons.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden="true"
      >
        {polygons.map((points, index) => (
          <g key={index}>
            <polygon className="q-roof-fill q-glow" points={points} />
            <polygon className="q-roof-line" points={points} />
          </g>
        ))}
      </svg>
    </div>
  );
}

function SketchFallback({
  roofs,
}: {
  roofs: LatLng[][];
}) {
  const polygons = useMemo(() => roofsToSvgPolygons(roofs), [roofs]);
  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="block h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="estimate-sat" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eaece7" />
            <stop offset="1" stopColor="#d7dcd3" />
          </linearGradient>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="url(#estimate-sat)" />
        <rect x="14" y="20" width="70" height="56" rx="3" fill="#cfd4cb" />
        <rect x="266" y="24" width="62" height="54" rx="3" fill="#cfd4cb" />
        <rect x="20" y="146" width="80" height="48" rx="3" fill="#cfd4cb" />
        <rect x="256" y="140" width="78" height="58" rx="3" fill="#cfd4cb" />
        <path d="M0 110 H340" stroke="#c5cbbf" strokeWidth="14" />
        <path d="M120 0 V210" stroke="#c5cbbf" strokeWidth="13" />
        {polygons.map((points, index) => (
          <g key={index}>
            <polygon className="q-roof-fill q-glow" points={points} />
            <polygon className="q-roof-line" points={points} />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function EstimateReveal({
  roofs,
  mapsEnabled,
  className,
}: {
  roofs: LatLng[][];
  mapsEnabled: boolean;
  className?: string;
}) {
  const variant = useFlowVariant();
  const valid = roofs.filter((path) => path.length >= 3);
  if (valid.length === 0) return null;

  return (
    <div
      className={`playing q-reveal relative overflow-hidden rounded-2xl border border-line shadow-[var(--shadow-soft)] ${
        className ?? ""
      }`}
    >
      <div
        className={`relative h-full w-full ${
          className ? "" : variant === "card" ? "h-[132px]" : "aspect-[340/210]"
        }`}
      >
        {mapsEnabled ? (
          <Map
            defaultBounds={{ ...padBounds(valid), padding: 0 }}
            mapTypeId="satellite"
            disableDefaultUI
            zoomControl={false}
            gestureHandling="none"
            clickableIcons={false}
            reuseMaps
            style={{ width: "100%", height: "100%" }}
          >
            <RoofOverlay roofs={valid} />
          </Map>
        ) : (
          <SketchFallback roofs={valid} />
        )}
        <div className="q-reveal-veil pointer-events-none absolute inset-0" />
        <div className="q-sweep pointer-events-none absolute inset-0" />
      </div>
    </div>
  );
}
