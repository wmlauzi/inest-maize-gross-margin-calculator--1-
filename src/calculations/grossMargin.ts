import { COST_CATEGORIES } from "../data/costCategories.ts";
import { AREA_UNITS, PRICE_FACTORS, YIELD_FACTORS } from "../data/units.ts";
import { areaToHa, getUnit, haToAcres, priceToPerKg, yieldToKgHa } from "./conversions.ts";
import { STATUS_MESSAGE, isErrorStatus, isNegativeOrInvalid, isProblemStatus, itemStatus, n, validateInputs } from "./validation.ts";
import type {
  AreaUnit, BudgetInputs, BudgetResult, BudgetStatus, CategoryResult, CostItem, Issue, ItemResult, ItemStatus, PriceUnit, ScenarioResult, YieldUnit,
} from "../types/index.ts";

const num = (v: number | null): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const isAreaUnit = (unit: unknown): unit is AreaUnit => typeof unit === "string" && AREA_UNITS.some((candidate) => candidate === unit);
const isYieldUnit = (unit: unknown): unit is YieldUnit => typeof unit === "string" && Object.prototype.hasOwnProperty.call(YIELD_FACTORS, unit);
const isPriceUnit = (unit: unknown): unit is PriceUnit => typeof unit === "string" && Object.prototype.hasOwnProperty.call(PRICE_FACTORS, unit);

/** Cost of one item (workbook Costs columns E-O). `areaHa` null => whole-farm values are null. */
export function evaluateItem(
  item: Pick<CostItem, "id" | "rate" | "rateUnit" | "price" | "priceUnit">,
  areaHa: number | null,
  statusOverride?: ItemStatus,
): ItemResult {
  const status = statusOverride ?? itemStatus(item.rate, item.rateUnit, item.price, item.priceUnit);
  const ru = getUnit(item.rateUnit);
  const pu = getUnit(item.priceUnit);
  const counted = status === "ok";

  // Rate is converted whenever rate and unit are usable (as in workbook column E).
  const rateStd = n(item.rate) > 0 && ru ? n(item.rate) * ru.factor : 0;
  // Price and cost only when the row is complete and compatible (workbook column I/J).
  const pricePerStd = counted && pu ? n(item.price) / pu.factor : 0;
  const costPerHa = rateStd * pricePerStd;
  const farmQty = ru && areaHa !== null ? rateStd * areaHa : null;
  const isMass = ru?.type === "mass";

  return {
    id: item.id,
    status,
    counted,
    ratePerHaStd: rateStd,
    stdUnit: ru ? ru.std : null,
    pricePerStdUnit: pricePerStd,
    costPerHa,
    costFarm: areaHa !== null ? costPerHa * areaHa : null,
    pctOfTotal: 0, // filled once total is known
    farmQtyStd: farmQty,
    farmTonnes: isMass && farmQty !== null ? farmQty / 1000 : null,
    farmBags50: isMass && farmQty !== null ? farmQty / 50 : null,
  };
}

/** One yield scenario (workbook Summary sections 2 and 3). */
export function buildScenario(
  yieldKgHa: number, tvcPerHa: number, pricePerKg: number, areaHa: number | null,
): ScenarioResult {
  const farm = (v: number) => (areaHa !== null ? v * areaHa : null);
  const prodFarm = farm(yieldKgHa);
  const giHa = yieldKgHa * pricePerKg;
  const breakEven = yieldKgHa > 0 ? tvcPerHa / yieldKgHa : null;
  return {
    yieldKgHa,
    productionKgHa: yieldKgHa,
    productionKgFarm: prodFarm,
    productionTonnesFarm: prodFarm !== null ? prodFarm / 1000 : null,
    productionBags50Farm: prodFarm !== null ? prodFarm / 50 : null,
    grossIncomePerHa: giHa,
    grossIncomeFarm: farm(giHa),
    tvcPerHa,
    tvcFarm: farm(tvcPerHa),
    grossMarginPerHa: giHa - tvcPerHa,
    grossMarginFarm: farm(giHa - tvcPerHa),
    variableCostPerKg: breakEven,
    breakEvenPerKg: breakEven,
    breakEvenPerTonne: breakEven !== null ? breakEven * 1000 : null,
    breakEvenPerBag50: breakEven !== null ? breakEven * 50 : null,
    returnPerMwk: tvcPerHa > 0 ? giHa / tvcPerHa : null,
  };
}

export function computeBudget(inputs: BudgetInputs, items: readonly CostItem[]): BudgetResult {
  const issues: Issue[] = validateInputs(inputs);

  const area = num(inputs.area);
  const areaHa = area !== null && area > 0 && isAreaUnit(inputs.areaUnit) ? areaToHa(area, inputs.areaUnit) : null;
  const yMain = num(inputs.yieldMain);
  const yAlt = num(inputs.yieldAlt);
  const yieldMainKgHa = yMain !== null && isYieldUnit(inputs.yieldMainUnit) ? yieldToKgHa(yMain, inputs.yieldMainUnit) : 0;
  const yieldAltKgHa = yAlt !== null && isYieldUnit(inputs.yieldAltUnit) ? yieldToKgHa(yAlt, inputs.yieldAltUnit) : 0;
  const priceIn = num(inputs.price);
  const pricePerKg = priceIn !== null && isPriceUnit(inputs.priceUnit) ? priceToPerKg(priceIn, inputs.priceUnit) : 0;

  // The linked transport rate follows the main yield (kg/ha) only when transport is required.
  const results: Record<string, ItemResult> = {};
  for (const it of items) {
    const linkedTransport = !!it.yieldLinked;
    const eff = linkedTransport
      ? { ...it, rate: inputs.transportArrangement === "transport_required" && yieldMainKgHa > 0 ? yieldMainKgHa : null, rateUnit: "kg" as const }
      : it;
    let statusOverride: ItemStatus | undefined;
    if (linkedTransport && inputs.transportArrangement === null) statusOverride = "transport_selection_needed";
    else if (linkedTransport && inputs.transportArrangement === "farm_gate") statusOverride = "farm_gate";
    else if (linkedTransport && n(it.price) === 0 && !isNegativeOrInvalid(it.price)) statusOverride = "price_needed";
    else if (!linkedTransport && itemStatus(it.rate, it.rateUnit, it.price, it.priceUnit) === "unused" &&
      (it.name.trim() !== "" || it.description.trim() !== "" || it.notes.trim() !== "")) statusOverride = "enter_rate";
    results[it.id] = evaluateItem(eff, areaHa, statusOverride);
  }

  // Categories - always all eleven, in workbook order.
  const catRaw = COST_CATEGORIES.map((c) => {
    const mine = items.filter((i) => i.categoryId === c.id);
    return {
      id: c.id, name: c.name,
      costPerHa: mine.reduce((s, i) => s + results[i.id].costPerHa, 0),
      itemCount: mine.filter((i) => results[i.id].status !== "unused").length,
      countedItems: mine.filter((i) => results[i.id].counted).length,
      problemItems: mine.filter((i) => isProblemStatus(results[i.id].status)).length,
    };
  });
  const tvcPerHa = catRaw.reduce((s, c) => s + c.costPerHa, 0);
  const tvcFarm = areaHa !== null ? tvcPerHa * areaHa : null;

  const categories: CategoryResult[] = catRaw.map((c) => ({
    ...c,
    costFarm: areaHa !== null ? c.costPerHa * areaHa : null,
    pctOfTotal: tvcPerHa > 0 ? (c.costPerHa / tvcPerHa) * 100 : 0,
  }));
  for (const it of items) results[it.id].pctOfTotal = tvcPerHa > 0 ? (results[it.id].costPerHa / tvcPerHa) * 100 : 0;

  // Derive the selected transport price independently of the main yield so the
  // alternative scenario remains available when only its own yield is entered.
  const tItem = items.find((i) => i.yieldLinked);
  const tUnit = getUnit(tItem?.priceUnit);
  const transportPricePerKg = inputs.transportArrangement === "transport_required" && tItem && tUnit?.type === "mass" &&
    n(tItem.price) > 0 && !isNegativeOrInvalid(tItem.price) ? n(tItem.price) / tUnit.factor : 0;
  const transportCostPerHa = tItem && inputs.transportArrangement === "transport_required" ? results[tItem.id].costPerHa : 0;

  // Scenarios are withheld (null) only when their own inputs are missing - no fabricated figures.
  const main = yieldMainKgHa > 0 && pricePerKg > 0 ? buildScenario(yieldMainKgHa, tvcPerHa, pricePerKg, areaHa) : null;
  // Alternative TVC/ha = non-transport costs + alt yield x transport price per kg.
  // With a main yield this equals the workbook's TVC + (alt - main) x transport price.
  const altTvc = tvcPerHa - transportCostPerHa + yieldAltKgHa * transportPricePerKg;
  const alt = yAlt !== null && isYieldUnit(inputs.yieldAltUnit) && pricePerKg > 0 ? buildScenario(yieldAltKgHa, altTvc, pricePerKg, areaHa) : null;

  // Item issues
  for (const it of items) {
    const s = results[it.id].status;
    if (isProblemStatus(s)) {
      const label = it.name || "Unnamed item";
      issues.push({ field: `item:${it.id}`, message: `${label}: ${STATUS_MESSAGE[s]}.`, severity: isErrorStatus(s) ? "error" : "warning" });
    }
  }
  if (yAlt === null && main) issues.push({ field: "yieldAlt", message: "Enter an alternative yield to see the comparison.", severity: "info" });

  // Completeness
  const anyInput =
    area !== null || yMain !== null || yAlt !== null || priceIn !== null ||
    inputs.transportArrangement !== null ||
    items.some((i) => !i.yieldLinked && (
      i.rate !== null || i.price !== null || !!i.rateUnit || !!i.priceUnit ||
      i.name.trim() !== "" || i.description.trim() !== "" || i.notes.trim() !== ""
    ));
  const blocking = issues.some((i) => i.severity === "error" || i.severity === "warning");
  const status: BudgetStatus = !anyInput ? "not_started" : blocking || !main || areaHa === null ? "in_progress" : "ready";

  return {
    areaHa, areaAcres: areaHa !== null ? haToAcres(areaHa) : null,
    yieldMainKgHa, yieldAltKgHa, pricePerKg, transportPricePerKg,
    items: results, categories, tvcPerHa, tvcFarm, main, alt, status, issues,
  };
}
