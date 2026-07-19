"use client";

import type { MaterialSwatchId } from "@/lib/materials";

/* Decorative inline-SVG material tiles (no remote images — CSP/asset free). */

function TileCourses({
  base,
  dark,
  light,
  rounded,
}: {
  base: string;
  dark: string;
  light: string;
  rounded: boolean;
}) {
  const rows = [0, 1, 2, 3, 4];
  const cols = [0, 1, 2, 3];
  const radius = rounded ? 5 : 1;
  return (
    <g>
      <rect width="64" height="64" fill={dark} />
      {rows.map((row) =>
        cols.map((col) => {
          const offset = row % 2 === 0 ? 0 : -8;
          return (
            <rect
              key={`${row}-${col}`}
              x={offset + col * 16 - 1}
              y={row * 14 - 2}
              width={15}
              height={15}
              rx={radius}
              fill={(row + col) % 3 === 0 ? light : base}
              stroke={dark}
              strokeWidth="1"
            />
          );
        }),
      )}
    </g>
  );
}

export function MaterialSwatch({ id }: { id: MaterialSwatchId }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className="size-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {id === "concrete" ? (
        <TileCourses base="#9aa0a8" dark="#7d838c" light="#adb3ba" rounded />
      ) : null}
      {id === "clay" ? (
        <TileCourses base="#b7623f" dark="#94492c" light="#c97a55" rounded />
      ) : null}
      {id === "slate" ? (
        <TileCourses base="#49535f" dark="#343c46" light="#5b6674" rounded={false} />
      ) : null}
      {id === "fibre" ? (
        <TileCourses base="#8d8478" dark="#6f675d" light="#a29a8e" rounded={false} />
      ) : null}
      {id === "felt" ? (
        <g>
          <rect width="64" height="64" fill="#3a3d42" />
          {Array.from({ length: 40 }).map((_, index) => (
            <circle
              key={index}
              cx={(index * 13.7) % 64}
              cy={(index * 23.3) % 64}
              r={index % 3 === 0 ? 1.4 : 0.9}
              fill={index % 4 === 0 ? "#5a5e66" : "#4b4f56"}
            />
          ))}
          <path d="M0 22h64M0 44h64" stroke="#2e3136" strokeWidth="2" />
        </g>
      ) : null}
      {id === "epdm" ? (
        <g>
          <rect width="64" height="64" fill="#26282d" />
          <path
            d="M0 16h64M0 32h64M0 48h64"
            stroke="#33363c"
            strokeWidth="3"
          />
          <rect width="64" height="64" fill="url(#epdm-sheen)" />
          <defs>
            <linearGradient id="epdm-sheen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.10" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
        </g>
      ) : null}
      {id === "grp" ? (
        <g>
          <rect width="64" height="64" fill="#c9ced5" />
          <path d="M0 21h64M0 43h64" stroke="#b4bac2" strokeWidth="2" />
          <rect width="64" height="64" fill="url(#grp-sheen)" />
          <defs>
            <linearGradient id="grp-sheen" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0.2" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="0.8" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
        </g>
      ) : null}
      {id === "unknown" ? (
        <g>
          <rect width="64" height="64" fill="#eef0f3" />
          <text
            x="32"
            y="41"
            textAnchor="middle"
            fontSize="28"
            fontWeight="700"
            fill="#9aa1ab"
          >
            ?
          </text>
        </g>
      ) : null}
    </svg>
  );
}
