import { describe, expect, it } from "vitest";
import { computeBudget } from "../../calculations/grossMargin.ts";
import { COST_CATEGORIES, TRANSPORT_ITEM_ID } from "../../data/costCategories.ts";
import type { BudgetInputs, CategoryId, CostItem } from "../../types/index.ts";
import { buildReportModel } from "../reportModel.ts";
import { areaRequirementPerUnit } from "../../calculations/conversions.ts";

const blankInputs = (): BudgetInputs => ({
  season: "", description: "", area: null, areaUnit: "ha", yieldMain: null, yieldMainUnit: "tonnes per ha",
  yieldAlt: null, yieldAltUnit: "tonnes per ha", price: null, priceUnit: "MWK per kg", transportArrangement: null,
});
let nextId = 0;
const item = (categoryId: CategoryId, patch: Partial<CostItem> = {}): CostItem => ({
  id: patch.id ?? `report-${++nextId}`, categoryId, name: "", description: "", rate: null, rateUnit: null,
  price: null, priceUnit: null, notes: "", userAdded: true, ...patch,
});
const transport = (price: number | null, priceUnit: CostItem["priceUnit"] = "tonne"): CostItem =>
  item("transport", { id: TRANSPORT_ITEM_ID, name: "Transport of grain", yieldLinked: true, rateUnit: "kg", price, priceUnit });
const scenario = () => ({
  inputs: {
    ...blankInputs(), area: 2, yieldMain: 8, yieldAlt: 5, price: 500, transportArrangement: "transport_required" as const,
  },
  items: [
    item("seed", { name: "Seed", rate: 8, rateUnit: "50 kg bag", price: 95000, priceUnit: "50 kg bag", notes: "Certified seed" }),
    item("other"),
    transport(20000),
  ],
});

describe("report model", () => {
  it("provides acre and hectare presentation conversions without changing whole-farm totals", () => {
    const { inputs, items } = scenario();
    const hectareReport = buildReportModel(inputs, computeBudget(inputs, items), items);
    const acreInputs = { ...inputs, area: 4.9421, areaUnit: "acres" as const };
    const acreReport = buildReportModel(acreInputs, computeBudget(acreInputs, items), items);

    expect(areaRequirementPerUnit(hectareReport.categories[0].costPerHa, "acres"))
      .toBeCloseTo(hectareReport.categories[0].costPerHa / 2.47105, 9);
    expect(acreReport.categories[0].costFarm).toBeCloseTo(hectareReport.categories[0].costFarm!, 6);
  });
  it("keeps all eleven categories in order and omits unused blank items", () => {
    const inputs = { ...blankInputs(), transportArrangement: "farm_gate" as const };
    const seed = item("seed");
    const report = buildReportModel(inputs, computeBudget(inputs, [transport(null), seed]), [transport(null), seed]);
    expect(report.categories.map((category) => category.name)).toEqual(COST_CATEGORIES.map((category) => category.name));
    expect(report.categories.every((category) => category.items.length === 0)).toBe(true);
    expect(report.ready).toBe(false);
  });

  it("exposes entered item details and the converted standard rate", () => {
    const { inputs, items } = scenario();
    const report = buildReportModel(inputs, computeBudget(inputs, items), items);
    const seed = report.categories[0].items[0];
    expect(seed.item.name).toBe("Seed");
    expect(seed.item.rateUnit).toBe("50 kg bag");
    expect(seed.result.ratePerHaStd).toBe(400);
    expect(seed.result.stdUnit).toBe("kg");
    expect(seed.result.costPerHa).toBe(760000);
    expect(seed.result.costFarm).toBe(1520000);
    expect(seed.item.notes).toBe("Certified seed");
  });

  it("excludes linked transport for farm-gate sale", () => {
    const inputs = { ...scenario().inputs, transportArrangement: "farm_gate" as const };
    const items = [transport(null)];
    const report = buildReportModel(inputs, computeBudget(inputs, items), items);
    expect(report.transport.state).toBe("farm_gate");
    expect(report.categories.find((category) => category.id === "transport")?.items).toHaveLength(0);
    expect(report.transport.alternativeCostPerHa).toBe(0);
    expect(report.ready).toBe(true);
  });

  it("shows included main and yield-adjusted alternative transport costs", () => {
    const { inputs, items } = scenario();
    const report = buildReportModel(inputs, computeBudget(inputs, items), items);
    expect(report.transport.state).toBe("included");
    expect(report.ready).toBe(true);
    expect(report.categories.find((category) => category.id === "transport")?.items[0].result.counted).toBe(true);
    expect(report.transport.alternativeCostPerHa).toBe(100000);
    expect(report.transport.alternativeCostFarm).toBe(200000);
  });

  it("marks unresolved transport and incomplete budgets without showing zero as its cost", () => {
    const inputs = { ...scenario().inputs, transportArrangement: "transport_required" as const };
    const items = [transport(null)];
    const report = buildReportModel(inputs, computeBudget(inputs, items), items);
    expect(report.ready).toBe(false);
    expect(report.transport.state).toBe("unresolved");
    expect(report.transport.alternativeCostPerHa).toBeNull();
    expect(report.categories.find((category) => category.id === "transport")?.items[0].result.counted).toBe(false);
  });

  it("keeps an unselected transport arrangement unresolved", () => {
    const inputs = { ...scenario().inputs, transportArrangement: null };
    const items = [transport(20000)];
    const report = buildReportModel(inputs, computeBudget(inputs, items), items);
    expect(report.ready).toBe(false);
    expect(report.transport.state).toBe("unselected");
    expect(report.transport.alternativeCostPerHa).toBeNull();
  });

  it("keeps an alternative-only budget distinct from the missing main scenario", () => {
    const { inputs, items } = scenario();
    const alternativeOnly = { ...inputs, yieldMain: null };
    const report = buildReportModel(alternativeOnly, computeBudget(alternativeOnly, items), items);
    expect(report.main).toBeNull();
    expect(report.alternative).not.toBeNull();
    expect(report.ready).toBe(false);
    expect(report.issues.some((issue) => issue.field === "yieldMain")).toBe(true);
  });
});
