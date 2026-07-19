"use client";

import { useRef } from "react";
import {
  Map,
  Polygon,
  Polyline,
  Rectangle,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

import type {
  GeoBounds,
  LatLng,
  RoofLineMeasurement,
  RoofSegment,
} from "@/lib/types";

type DeveloperRoofMapProps = {
  buildingBounds: GeoBounds;
  segments: RoofSegment[];
  selection: LatLng[];
  roofLines: RoofLineMeasurement | null;
  showSegmentBounds: boolean;
  onSelectionChange: (path: LatLng[]) => void;
};

export function DeveloperRoofMap({
  buildingBounds,
  segments,
  selection,
  roofLines,
  showSegmentBounds,
  onSelectionChange,
}: DeveloperRoofMapProps) {
  const geometry = useMapsLibrary("geometry");
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  function addPoint() {
    const path = polygonRef.current?.getPath();
    if (!path || !geometry || path.getLength() < 2) return;

    let longestIndex = 0;
    let longestDistance = -1;
    for (let index = 0; index < path.getLength(); index += 1) {
      const start = path.getAt(index);
      const end = path.getAt((index + 1) % path.getLength());
      const distance = geometry.spherical.computeDistanceBetween(start, end);
      if (distance > longestDistance) {
        longestDistance = distance;
        longestIndex = index;
      }
    }

    const midpoint = geometry.spherical.interpolate(
      path.getAt(longestIndex),
      path.getAt((longestIndex + 1) % path.getLength()),
      0.5,
    );
    path.insertAt(longestIndex + 1, midpoint);
  }

  return (
    <div className="relative h-[560px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <Map
        defaultBounds={{ ...buildingBounds, padding: 70 }}
        mapTypeId="satellite"
        disableDefaultUI
        clickableIcons={false}
        gestureHandling="greedy"
        keyboardShortcuts
        reuseMaps
        style={{ width: "100%", height: "100%" }}
      >
        <Rectangle
          bounds={buildingBounds}
          clickable={false}
          fillColor="#22d3ee"
          fillOpacity={0.03}
          strokeColor="#22d3ee"
          strokeOpacity={0.9}
          strokeWeight={2}
        />

        {showSegmentBounds
          ? segments.map((segment, index) => (
              <Rectangle
                key={`${index}-${segment.pitchDegrees}-${segment.azimuthDegrees}`}
                bounds={segment.boundingBox}
                clickable={false}
                fillColor="#a78bfa"
                fillOpacity={0.025}
                strokeColor="#a78bfa"
                strokeOpacity={0.55}
                strokeWeight={1}
              />
            ))
          : null}

        {roofLines?.features.map((feature) => {
          const colour = {
            ridge: "#22c55e",
            hip: "#fb923c",
            valley: "#38bdf8",
            unresolved: "#94a3b8",
          }[feature.type];
          return (
            <Polyline
              key={`${feature.segmentA}-${feature.segmentB}-${feature.type}`}
              path={[feature.start, feature.end]}
              clickable={false}
              geodesic
              strokeColor={colour}
              strokeOpacity={feature.confidence === "medium" ? 0.95 : 0.55}
              strokeWeight={feature.confidence === "medium" ? 4 : 2}
              zIndex={4}
            />
          );
        })}

        <Polygon
          ref={polygonRef}
          defaultPaths={selection}
          editable
          draggable={false}
          geodesic
          fillColor="#facc15"
          fillOpacity={0.28}
          strokeColor="#fde047"
          strokeOpacity={1}
          strokeWeight={3}
          onPathsChanged={(paths) => {
            const nextPath = paths[0]?.map((point) => ({
              lat: point.lat(),
              lng: point.lng(),
            }));
            if (nextPath?.length >= 3) onSelectionChange(nextPath);
          }}
        />
      </Map>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 text-[11px] font-semibold">
        <span className="rounded bg-slate-950/85 px-2 py-1 text-cyan-300">
          Cyan: building bbox
        </span>
        <span className="rounded bg-slate-950/85 px-2 py-1 text-violet-300">
          Violet: segment bboxes
        </span>
        <span className="rounded bg-slate-950/85 px-2 py-1 text-yellow-300">
          Yellow: priced selection
        </span>
        <span className="rounded bg-slate-950/85 px-2 py-1 text-emerald-300">
          Lines: ridge / hip / valley candidates
        </span>
      </div>

      <button
        type="button"
        onClick={addPoint}
        disabled={!geometry}
        className="absolute bottom-3 left-3 rounded-md border border-slate-600 bg-slate-950/90 px-3 py-2 text-xs font-bold text-white shadow disabled:opacity-50"
      >
        + Insert midpoint on longest edge
      </button>
    </div>
  );
}
