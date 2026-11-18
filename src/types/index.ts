export type UnitType = "mass" | "volume" | "labour" | "area" | "water depth" | "lump sum";
export type UnitName = "kg" | "g" | "tonne" | "50 kg bag" | "25 kg bag" | "l" | "ml" | "day" | "ha" | "mm" | "lump sum";
export type AreaUnit = "ha" | "acres";
export type YieldUnit = "kg per ha" | "tonnes per ha";
export type PriceUnit = "MWK per kg" | "MWK per tonne" | "MWK per 50 kg bag";
export type TransportArrangement = "farm_gate" | "transport_required" | null;

/** Blank numeric inputs are always `null` - nothing is ever prefilled. */
export interface BudgetInputs {
  season: string;
  description: string;
  area: number | null;
  areaUnit: AreaUnit | null;
  yieldMain: number | null;
  yieldMainUnit: YieldUnit | null;
  yieldAlt: number | null;
  yieldAltUnit: YieldUnit | null;
  price: number | null;
  priceUnit: PriceUnit | null;
  transportArrangement: TransportArrangement;
}

export type CategoryId =
  | "seed" | "fertiliser" | "herbicides" | "insecticides" | "growth-regulators" | "labour"
  | "tractor" | "harvesting" | "transport" | "irrigation" | "other";

export interface CostItem {
  id: string;
  categoryId: CategoryId;
  name: string;
  description: string;
  rate: number | null;
  rateUnit: UnitName | null;
  price: number | null;
  priceUnit: UnitName | null;
  notes: string;
  userAdded: boolean;
  /** Transport of grain: rate is taken from the main expected yield (kg/ha). */
  yieldLinked?: boolean;
}

export type ItemStatus =
  | "unused" | "ok" | "invalid_value" | "enter_rate" | "select_unit" | "invalid_unit"
  | "price_needed" | "select_price_unit" | "invalid_factor" | "unit_mismatch"
  | "transport_selection_needed" | "farm_gate";

export interface ItemResult {
  id: string;
  status: ItemStatus;
  counted: boolean;
  ratePerHaStd: number;
  stdUnit: string | null;
  pricePerStdUnit: number;
  costPerHa: number;
  costFarm: number | null;
  pctOfTotal: number;
  farmQtyStd: number | null;
  farmTonnes: number | null;
  farmBags50: number | null;
}

export interface CategoryResult {
  id: CategoryId;
  name: string;
  costPerHa: number;
  costFarm: number | null;
  pctOfTotal: number;
  itemCount: number;
  countedItems: number;
  problemItems: number;
}

/** `null` means "n/a" (not computable), never a silently wrong number. */
export interface ScenarioResult {
  yieldKgHa: number;
  productionKgHa: number;
  productionKgFarm: number | null;
  productionTonnesFarm: number | null;
  productionBags50Farm: number | null;
  grossIncomePerHa: number;
  grossIncomeFarm: number | null;
  tvcPerHa: number;
  tvcFarm: number | null;
  grossMarginPerHa: number;
  grossMarginFarm: number | null;
  variableCostPerKg: number | null;
  breakEvenPerKg: number | null;
  breakEvenPerTonne: number | null;
  breakEvenPerBag50: number | null;
  returnPerMwk: number | null;
}

export type BudgetStatus = "not_started" | "in_progress" | "ready";
export interface Issue { field: string; message: string; severity: "error" | "warning" | "info"; }

export interface BudgetResult {
  areaHa: number | null;
  areaAcres: number | null;
  yieldMainKgHa: number;
  yieldAltKgHa: number;
  pricePerKg: number;
  transportPricePerKg: number;
  items: Record<string, ItemResult>;
  categories: CategoryResult[];
  tvcPerHa: number;
  tvcFarm: number | null;
  main: ScenarioResult | null;
  alt: ScenarioResult | null;
  status: BudgetStatus;
  issues: Issue[];
}
