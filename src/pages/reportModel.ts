import { COST_CATEGORIES } from "../data/costCategories.ts";
import type { BudgetInputs, BudgetResult, CostItem, ItemResult } from "../types/index.ts";

export type ReportTransportState = "farm_gate" | "included" | "unresolved" | "unselected";

export interface ReportCostItem {
  item: CostItem;
  result: ItemResult;
}

export interface ReportCostCategory {
  id: (typeof COST_CATEGORIES)[number]["id"];
  name: string;
  costPerHa: number;
  costFarm: number | null;
  items: ReportCostItem[];
}

export interface ReportModel {
  ready: boolean;
  issues: BudgetResult["issues"];
  main: BudgetResult["main"];
  alternative: BudgetResult["alt"];
  transport: {
    state: ReportTransportState;
    item: ReportCostItem | null;
    alternativeCostPerHa: number | null;
    alternativeCostFarm: number | null;
  };
  categories: ReportCostCategory[];
}

const isStarted = (item: CostItem, result: ItemResult): boolean =>
  item.yieldLinked ? false : result.status !== "unused";

export function buildReportModel(
  inputs: BudgetInputs,
  result: BudgetResult,
  items: readonly CostItem[],
): ReportModel {
  const linkedItem = items.find((item) => item.yieldLinked);
  const linkedResult = linkedItem ? result.items[linkedItem.id] : null;
  const transportState: ReportTransportState = inputs.transportArrangement === null
    ? "unselected"
    : inputs.transportArrangement === "farm_gate"
      ? "farm_gate"
      : linkedResult?.status === "ok" ? "included" : "unresolved";
  const transportItem = linkedItem && linkedResult ? { item: linkedItem, result: linkedResult } : null;
  const alternativeCostPerHa = result.alt === null ? null
    : transportState === "farm_gate" ? 0
      : transportState === "included" ? result.alt.yieldKgHa * result.transportPricePerKg
        : null;

  const categories = COST_CATEGORIES.map((category) => {
    const categoryResult = result.categories.find((entry) => entry.id === category.id);
    if (!categoryResult) throw new Error(`Missing calculated cost category: ${category.id}`);
    const categoryItems = items
      .filter((item) => item.categoryId === category.id)
      .filter((item) => item.yieldLinked
        ? inputs.transportArrangement === "transport_required"
        : isStarted(item, result.items[item.id]))
      .map((item) => {
        const itemResult = result.items[item.id];
        if (!itemResult) throw new Error(`Missing calculated cost item: ${item.id}`);
        return { item, result: itemResult };
      });
    return {
      id: category.id,
      name: category.name,
      costPerHa: categoryResult.costPerHa,
      costFarm: categoryResult.costFarm,
      items: categoryItems,
    };
  });

  return {
    ready: result.status === "ready",
    issues: result.issues.filter((issue) => issue.severity !== "info"),
    main: result.main,
    alternative: result.alt,
    transport: {
      state: transportState,
      item: transportItem,
      alternativeCostPerHa,
      alternativeCostFarm: alternativeCostPerHa !== null && result.areaHa !== null
        ? alternativeCostPerHa * result.areaHa
        : null,
    },
    categories,
  };
}
