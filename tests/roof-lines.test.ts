import { describe, expect, it } from "vitest";

import { measureRoofLines } from "@/lib/roof-lines";
import type { GeoBounds, LatLng, RoofSegment, SolarScan } from "@/lib/types";

const ORIGIN: LatLng = { lat: 52, lng: 0 };
const LAT_METRES = 111_320;
const LNG_METRES = LAT_METRES * Math.cos((ORIGIN.lat * Math.PI) / 180);

function point(x: number, y: number): LatLng {
  return {
    lat: ORIGIN.lat + y / LAT_METRES,
    lng: ORIGIN.lng + x / LNG_METRES,
  };
}

const BOUNDS: GeoBounds = {
  north: point(0, 10).lat,
  south: point(0, -10).lat,
  east: point(10, 0).lng,
  west: point(-10, 0).lng,
};

function segment(
  center: LatLng,
  azimuthDegrees: number,
  includePlane = true,
): RoofSegment {
  return {
    pitchDegrees: 30,
    azimuthDegrees,
    areaMeters2: 50,
    groundAreaMeters2: 43.3,
    boundingBox: BOUNDS,
    center: includePlane ? center : undefined,
    planeHeightAtCenterMeters: includePlane ? 7 : undefined,
  };
}

function scan(segments: RoofSegment[]): SolarScan {
  return {
    center: ORIGIN,
    boundingBox: BOUNDS,
    imageryQuality: "HIGH",
    imageryDate: "2026-01-01",
    wholeRoofStats: {
      areaMeters2: segments.length * 50,
      groundAreaMeters2: segments.length * 43.3,
    },
    roofSegmentStats: segments,
  };
}

describe("experimental roof-line measurement", () => {
  it("classifies opposing planes that fall away from the line as a ridge", () => {
    const result = measureRoofLines(
      scan([segment(point(0, 5), 0), segment(point(0, -5), 180)]),
    );

    expect(result.features).toHaveLength(1);
    expect(result.features[0].type).toBe("ridge");
    expect(result.totals.ridge).toBeCloseTo(20, 1);
  });

  it("classifies planes that fall toward the line as a valley", () => {
    const result = measureRoofLines(
      scan([segment(point(0, 5), 180), segment(point(0, -5), 0)]),
    );

    expect(result.features).toHaveLength(1);
    expect(result.features[0].type).toBe("valley");
    expect(result.totals.valley).toBeCloseTo(20, 1);
  });

  it("classifies non-opposing convex planes as a hip", () => {
    const result = measureRoofLines(
      scan([segment(point(0, 5), 0), segment(point(5, 0), 90)]),
    );

    expect(result.features).toHaveLength(1);
    expect(result.features[0].type).toBe("hip");
    expect(result.totals.hip).toBeGreaterThan(10);
  });

  it("skips segments without plane centres or heights", () => {
    const result = measureRoofLines(
      scan([
        segment(point(0, 5), 0, false),
        segment(point(0, -5), 180),
      ]),
    );

    expect(result.features).toHaveLength(0);
    expect(result.skippedPairs).toBe(1);
  });
});
