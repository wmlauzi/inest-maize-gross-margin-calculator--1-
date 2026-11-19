import type { UnitName, UnitType, AreaUnit, YieldUnit, PriceUnit } from "../types/index.ts";

/** Single source of truth for conversions (workbook sheet "Lists"). */
export const ACRES_PER_HA = 2.47105;
export const KG_PER_TONNE = 1000;

export interface UnitDef { name: UnitName; type: UnitType; factor: number; std: string; label: string; }

export const UNITS: readonly UnitDef[] = [
  { name: "kg", type: "mass", factor: 1, std: "kg", label: "kg" },
  { name: "g", type: "mass", factor: 0.001, std: "kg", label: "g" },
  { name: "tonne", type: "mass", factor: 1000, std: "kg", label: "tonne" },
  { name: "50 kg bag", type: "mass", factor: 50, std: "kg", label: "50 kg bag" },
  { name: "25 kg bag", type: "mass", factor: 25, std: "kg", label: "25 kg bag" },
  { name: "l", type: "volume", factor: 1, std: "l", label: "litre (l)" },
  { name: "ml", type: "volume", factor: 0.001, std: "l", label: "millilitre (ml)" },
  { name: "day", type: "labour", factor: 1, std: "day", label: "labour day" },
  { name: "ha", type: "area", factor: 1, std: "ha", label: "hectare (ha)" },
  { name: "acre", type: "area", factor: 1 / ACRES_PER_HA, std: "ha", label: "acre" },
  { name: "mm", type: "water depth", factor: 1, std: "mm", label: "mm of water" },
  { name: "lump sum", type: "lump sum", factor: 1, std: "lump sum", label: "lump sum" },
];

export const AREA_UNITS: readonly AreaUnit[] = ["ha", "acres"];
export const YIELD_FACTORS: Record<YieldUnit, number> = { "kg per ha": 1, "tonnes per ha": 1000 };
/** kg per price unit (workbook Price_Factors). */
export const PRICE_FACTORS: Record<PriceUnit, number> = { "MWK per kg": 1, "MWK per tonne": 1000, "MWK per 50 kg bag": 50 };
