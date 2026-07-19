import type { JobType, Material } from "@/lib/types";

export type MaterialSwatchId =
  | "concrete"
  | "clay"
  | "slate"
  | "fibre"
  | "felt"
  | "epdm"
  | "grp"
  | "unknown";

export type MaterialOption = {
  value: Material;
  label: string;
  swatch: MaterialSwatchId;
};

export const PITCHED_REPLACEMENT_MATERIALS: MaterialOption[] = [
  { value: "concrete_tile", label: "Concrete tile", swatch: "concrete" },
  { value: "clay_tile", label: "Clay tile", swatch: "clay" },
  { value: "natural_slate", label: "Natural slate", swatch: "slate" },
  { value: "not_sure", label: "Not sure", swatch: "unknown" },
];

export const FLAT_REPLACEMENT_MATERIALS: MaterialOption[] = [
  { value: "flat_bitumen", label: "Felt / bitumen", swatch: "felt" },
  { value: "flat_epdm", label: "Rubber (EPDM)", swatch: "epdm" },
  { value: "flat_grp", label: "Fibreglass (GRP)", swatch: "grp" },
  { value: "not_sure", label: "Not sure", swatch: "unknown" },
];

export const REPAIR_MATERIALS: MaterialOption[] = [
  { value: "concrete_tile", label: "Concrete tile", swatch: "concrete" },
  { value: "clay_tile", label: "Clay tile", swatch: "clay" },
  { value: "natural_slate", label: "Natural slate", swatch: "slate" },
  { value: "fibre_cement", label: "Fibre cement", swatch: "fibre" },
  { value: "felt", label: "Felt", swatch: "felt" },
  { value: "flat_epdm", label: "Rubber (EPDM)", swatch: "epdm" },
  { value: "flat_grp", label: "Fibreglass (GRP)", swatch: "grp" },
  { value: "not_sure", label: "Not sure", swatch: "unknown" },
];

export function materialOptionsFor(jobType: JobType | null): MaterialOption[] {
  switch (jobType) {
    case "full_replacement":
      return PITCHED_REPLACEMENT_MATERIALS;
    case "flat_roof_replacement":
      return FLAT_REPLACEMENT_MATERIALS;
    case "tile_or_slate_repair":
      return REPAIR_MATERIALS;
    default:
      return [];
  }
}

export function materialLabel(value: Material | null): string {
  if (!value) return "Not specified";
  for (const option of REPAIR_MATERIALS.concat(
    PITCHED_REPLACEMENT_MATERIALS,
    FLAT_REPLACEMENT_MATERIALS,
  )) {
    if (option.value === value) return option.label;
  }
  return value.replace(/_/g, " ");
}
