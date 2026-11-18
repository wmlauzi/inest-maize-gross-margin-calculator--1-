import { getUnit, isValidFactor } from "./conversions.ts";
import { AREA_UNITS, PRICE_FACTORS, YIELD_FACTORS } from "../data/units.ts";
import type { BudgetInputs, Issue, ItemStatus, UnitName } from "../types/index.ts";

const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
/** Workbook N(): blank / non-numeric counts as 0. */
export const n = (v: number | null | undefined): number => (isNum(v) ? v : 0);

export function isNegativeOrInvalid(v: number | null | undefined): boolean {
  if (v === null || v === undefined) return false;
  return !Number.isFinite(v) || v < 0;
}

/**
 * Item status - same order of tests as workbook Costs column P,
 * with an extra guard for negative/NaN values and invalid conversion factors.
 */
export function itemStatus(
  rate: number | null, rateUnit: UnitName | null, price: number | null, priceUnit: UnitName | null,
): ItemStatus {
  if (isNegativeOrInvalid(rate) || isNegativeOrInvalid(price)) return "invalid_value";
  if (n(rate) === 0 && n(price) === 0 && rate === null && price === null && !rateUnit && !priceUnit) return "unused";
  if (n(rate) === 0) return "enter_rate";
  if (!rateUnit) return "select_unit";
  const ru = getUnit(rateUnit);
  if (!ru) return "invalid_unit";
  if (n(price) === 0) return "price_needed";
  if (!priceUnit) return "select_price_unit";
  const pu = getUnit(priceUnit);
  if (!pu) return "invalid_unit";
  if (!isValidFactor(ru.factor) || !isValidFactor(pu.factor)) return "invalid_factor";
  if (ru.type !== pu.type) return "unit_mismatch";
  return "ok";
}

export const STATUS_MESSAGE: Record<ItemStatus, string> = {
  unused: "Not used",
  ok: "Complete",
  invalid_value: "Amounts cannot be negative; check the rate and price",
  enter_rate: "Enter the quantity or rate per hectare",
  select_unit: "Choose a unit for the quantity or rate",
  invalid_unit: "Choose a valid unit",
  price_needed: "Enter the unit price",
  select_price_unit: "Choose the unit used for the price",
  invalid_factor: "This unit cannot be converted; choose another unit",
  unit_mismatch: "Choose a price unit that matches the quantity unit type",
  transport_selection_needed: "Select a transport arrangement",
  farm_gate: "No transport cost included (farm-gate sale)",
};

export const isProblemStatus = (s: ItemStatus) => s !== "ok" && s !== "unused" && s !== "farm_gate";
export const isErrorStatus = (s: ItemStatus) =>
  s === "invalid_value" || s === "invalid_unit" || s === "invalid_factor" || s === "unit_mismatch";

/** Field-level checks for the farm setup screen. */
export function validateInputs(i: BudgetInputs): Issue[] {
  const out: Issue[] = [];
  const check = (field: string, label: string, v: number | null | undefined, required: boolean, positive: boolean) => {
    if (isNegativeOrInvalid(v)) out.push({ field, message: `${label} cannot be negative or invalid.`, severity: "error" });
    else if (v === null || v === undefined) {
      out.push({ field, message: `Enter ${label.toLowerCase()}.`, severity: required ? "warning" : "info" });
    } else if (positive && v === 0) out.push({ field, message: `${label} must be greater than zero.`, severity: "warning" });
  };
  const checkUnit = (field: string, label: string, value: unknown, allowed: readonly string[]) => {
    if (value === null || value === undefined || value === "") {
      out.push({ field, message: `Choose a ${label.toLowerCase()}.`, severity: "warning" });
    } else if (typeof value !== "string" || !allowed.includes(value)) {
      out.push({ field, message: `Choose a valid ${label.toLowerCase()}.`, severity: "error" });
    }
  };
  check("area", "Farm area", i.area, true, true);
  checkUnit("areaUnit", "Farm area unit", i.areaUnit, AREA_UNITS);
  check("yieldMain", "Main expected yield", i.yieldMain, true, true);
  checkUnit("yieldMainUnit", "Main yield unit", i.yieldMainUnit, Object.keys(YIELD_FACTORS));
  check("yieldAlt", "Alternative expected yield", i.yieldAlt, false, false);
  if (i.yieldAlt !== null) checkUnit("yieldAltUnit", "Alternative yield unit", i.yieldAltUnit, Object.keys(YIELD_FACTORS));
  check("price", "Selling price", i.price, true, true);
  checkUnit("priceUnit", "Selling price unit", i.priceUnit, Object.keys(PRICE_FACTORS));
  return out;
}
