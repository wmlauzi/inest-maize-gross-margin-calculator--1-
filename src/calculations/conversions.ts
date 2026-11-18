import { ACRES_PER_HA, KG_PER_TONNE, PRICE_FACTORS, UNITS, YIELD_FACTORS } from "../data/units.ts";
import type { UnitDef } from "../data/units.ts";
import type { AreaUnit, PriceUnit, UnitName, YieldUnit } from "../types/index.ts";

export function getUnit(name: string | null | undefined): UnitDef | null {
  if (!name) return null;
  return UNITS.find((u) => u.name === name) ?? null;
}

/** A usable factor is finite and strictly positive. */
export function isValidFactor(f: number | undefined | null): f is number {
  return typeof f === "number" && Number.isFinite(f) && f > 0;
}

/** value in `unit` -> value in the unit's standard unit (kg, l, day, ha, mm, lump sum). */
export function toStandard(value: number, unit: UnitName): number {
  const u = getUnit(unit);
  if (!u || !isValidFactor(u.factor)) return NaN;
  return value * u.factor;
}

/** Convert between two units of the same type; NaN if incompatible. */
export function convertUnits(value: number, from: UnitName, to: UnitName): number {
  const a = getUnit(from);
  const b = getUnit(to);
  if (!a || !b || a.type !== b.type || !isValidFactor(a.factor) || !isValidFactor(b.factor)) return NaN;
  return (value * a.factor) / b.factor;
}

export const MASS_UNITS: readonly UnitName[] = ["kg", "g", "tonne", "50 kg bag", "25 kg bag"];

export function convertMass(value: number, from: UnitName, to: UnitName): number {
  return convertUnits(value, from, to);
}

export function areaToHa(value: number, unit: AreaUnit): number {
  return unit === "ha" ? value : value / ACRES_PER_HA;
}
export function haToAcres(ha: number): number {
  return ha * ACRES_PER_HA;
}

/** Convert an existing per-hectare quantity for display or entry in the selected area unit. */
export function areaRequirementPerUnit(valuePerHa: number, unit: AreaUnit): number {
  return unit === "ha" ? valuePerHa : valuePerHa / ACRES_PER_HA;
}

/** Convert a quantity entered in the selected area unit back to the engine's per-hectare basis. */
export function areaRequirementToHa(valuePerUnit: number, unit: AreaUnit): number {
  return unit === "ha" ? valuePerUnit : valuePerUnit * ACRES_PER_HA;
}

export function yieldToKgHa(value: number, unit: YieldUnit): number {
  return value * YIELD_FACTORS[unit];
}

export function priceToPerKg(value: number, unit: PriceUnit): number {
  return value / PRICE_FACTORS[unit];
}

export const CONVERTER_PRICE_UNITS = ["MWK per kg", "MWK per tonne", "MWK per 50 kg bag", "MWK per 25 kg bag"] as const;
export type ConverterPriceUnit = (typeof CONVERTER_PRICE_UNITS)[number];
const CONVERTER_PRICE_KG: Record<ConverterPriceUnit, number> = {
  "MWK per kg": 1, "MWK per tonne": KG_PER_TONNE, "MWK per 50 kg bag": 50, "MWK per 25 kg bag": 25,
};

/** Maize price converter (stand-alone; never feeds the budget). */
export function convertPrice(value: number, unit: ConverterPriceUnit) {
  const perKg = value / CONVERTER_PRICE_KG[unit];
  return { perKg, perTonne: perKg * 1000, per50kgBag: perKg * 50, per25kgBag: perKg * 25 };
}

/** Transport converter (workbook Converters section 4). Null when tonnes per load is not > 0. */
export function truckloadPrice(pricePerLoad: number, tonnesPerLoad: number) {
  if (!(tonnesPerLoad > 0) || !(pricePerLoad >= 0)) return null;
  const perTonne = pricePerLoad / tonnesPerLoad;
  return { perTonne, per50kgBag: perTonne / 20, perKg: perTonne / 1000 };
}
