import { describe, it, expect } from "vitest";
import {
  areaRequirementPerUnit, areaRequirementToHa, areaToHa, convertMass, convertPrice, convertUnits, haToAcres, priceToPerKg, truckloadPrice, yieldToKgHa,
} from "../conversions.ts";
import { computeBudget } from "../grossMargin.ts";
import { itemStatus } from "../validation.ts";
import { COST_CATEGORIES, TRANSPORT_ITEM_ID } from "../../data/costCategories.ts";
import { formatAreaUnitMessage, getAreaUnitText } from "../../lib/areaUnitText.ts";
import type { BudgetInputs, CategoryId, CostItem } from "../../types/index.ts";

const blankInputs = (): BudgetInputs => ({
  season: "", description: "", area: null, areaUnit: "ha", yieldMain: null, yieldMainUnit: "tonnes per ha",
  yieldAlt: null, yieldAltUnit: "tonnes per ha", price: null, priceUnit: "MWK per kg", transportArrangement: null,
});
let seq = 0;
const item = (categoryId: CategoryId, p: Partial<CostItem> = {}): CostItem => ({
  id: p.id ?? `i${++seq}`, categoryId, name: "", description: "", rate: null, rateUnit: null,
  price: null, priceUnit: null, notes: "", userAdded: true, ...p,
});
const transport = (price: number | null, priceUnit: CostItem["priceUnit"] = "tonne"): CostItem =>
  item("transport", { id: TRANSPORT_ITEM_ID, name: "Transport of grain", yieldLinked: true, rateUnit: "kg", price, priceUnit });

/** A realistic *test* scenario - invented numbers used only inside tests. */
const scenario = () => {
  const inputs: BudgetInputs = {
    ...blankInputs(), area: 2, areaUnit: "ha", yieldMain: 8, yieldAlt: 5, price: 500, priceUnit: "MWK per kg",
    transportArrangement: "transport_required",
  };
  const items = [
    item("seed", { rate: 25, rateUnit: "kg", price: 3000, priceUnit: "kg" }),
    item("fertiliser", { rate: 8, rateUnit: "50 kg bag", price: 95000, priceUnit: "50 kg bag" }),
    item("fertiliser", { rate: 200, rateUnit: "kg", price: 1000, priceUnit: "tonne" }),
    item("herbicides", { rate: 50, rateUnit: "g", price: 800, priceUnit: "g" }),
    item("labour", { rate: 15, rateUnit: "day", price: 4000, priceUnit: "day" }),
    transport(20000, "tonne"),
  ];
  return { inputs, items };
};

describe("conversions (workbook Checks 6-18)", () => {
  it("1,000 kg = 1 tonne", () => expect(convertMass(1000, "kg", "tonne")).toBeCloseTo(1, 9));
  it("10 x 50 kg bags = 500 kg", () => expect(convertMass(10, "50 kg bag", "kg")).toBeCloseTo(500, 9));
  it("500 kg = 10 x 50 kg bags", () => expect(convertMass(500, "kg", "50 kg bag")).toBeCloseTo(10, 9));
  it("100 kg = 4 x 25 kg bags", () => expect(convertMass(100, "kg", "25 kg bag")).toBeCloseTo(4, 9));
  it("8 x 25 kg bags = 200 kg", () => expect(convertMass(8, "25 kg bag", "kg")).toBeCloseTo(200, 9));
  it("2 tonnes = 40 x 50 kg bags", () => expect(convertMass(2, "tonne", "50 kg bag")).toBeCloseTo(40, 9));
  it("2,500 g = 2.5 kg", () => expect(convertMass(2500, "g", "kg")).toBeCloseTo(2.5, 9));
  it("3 kg = 3,000 g", () => expect(convertMass(3, "kg", "g")).toBeCloseTo(3000, 9));
  it("1 ha = 2.47105 acres", () => expect(haToAcres(1)).toBeCloseTo(2.47105, 9));
  it("1 acre converts to 1 / 2.47105 hectares", () => expect(convertUnits(1, "acre", "ha")).toBeCloseTo(1 / 2.47105, 9));
  it("10 acres = about 4.0469 ha", () => expect(areaToHa(10, "acres")).toBeCloseTo(4.0469, 4));
  it("converts per-ha requirements to per-acre without changing the physical quantity", () => {
    const perAcre = areaRequirementPerUnit(25, "acres");
    expect(perAcre).toBeCloseTo(25 / 2.47105, 9);
    expect(areaRequirementToHa(perAcre, "acres")).toBeCloseTo(25, 9);
  });
  it("keeps hectare requirements unchanged", () => {
    expect(areaRequirementPerUnit(25, "ha")).toBe(25);
    expect(areaRequirementToHa(25, "ha")).toBe(25);
  });
  it("round-trips an entered per-acre rate without rounding stored values", () => {
    const storedPerHa = areaRequirementToHa(10, "acres");
    expect(storedPerHa).toBe(24.7105);
    expect(areaRequirementPerUnit(storedPerHa, "acres")).toBe(10);
    expect(areaRequirementToHa(10, "ha")).toBe(10);
  });
  it.each([
    ["acres", "Rate per acre", "Enter the quantity or rate per acre", "Enter the quantity or rate per acre."],
    ["ha", "Rate per ha", "Enter the quantity or rate per ha", "Enter the quantity or rate per ha."],
  ] as const)("provides consistent rate text for %s", (unit, label, hint, validation) => {
    const text = getAreaUnitText(unit);
    expect(text.rateLabel).toBe(label);
    expect(text.inputHint).toBe(hint);
    expect(text.validationMessage).toBe(validation);
  });
  it("10 t/ha = 10,000 kg/ha", () => expect(yieldToKgHa(10, "tonnes per ha")).toBeCloseTo(10000, 9));
  it("MWK 2,500 per 50 kg bag = MWK 50 per kg", () => expect(priceToPerKg(2500, "MWK per 50 kg bag")).toBeCloseTo(50, 9));
  it("MWK 1,000 per tonne = MWK 1 per kg", () => expect(priceToPerKg(1000, "MWK per tonne")).toBeCloseTo(1, 9));
  it("refuses to convert incompatible unit types", () => expect(convertUnits(1, "kg", "l")).toBeNaN());
  it("price converter incl. 25 kg bag", () => {
    const r = convertPrice(50, "MWK per kg");
    expect(r.perTonne).toBeCloseTo(50000, 9); expect(r.per50kgBag).toBeCloseTo(2500, 9); expect(r.per25kgBag).toBeCloseTo(1250, 9);
  });
  it("truck-load converter", () => {
    const r = truckloadPrice(600000, 30)!;
    expect(r.perTonne).toBeCloseTo(20000, 9); expect(r.per50kgBag).toBeCloseTo(1000, 9); expect(r.perKg).toBeCloseTo(20, 9);
    expect(truckloadPrice(100, 0)).toBeNull();
  });
});

describe("item status (workbook column P)", () => {
  it("blank item is unused", () => expect(itemStatus(null, null, null, null)).toBe("unused"));
  it("price without rate", () => expect(itemStatus(null, "kg", 10, "kg")).toBe("enter_rate"));
  it("rate without unit", () => expect(itemStatus(5, null, 10, "kg")).toBe("select_unit"));
  it("rate without price", () => expect(itemStatus(5, "kg", null, "kg")).toBe("price_needed"));
  it("price without price unit", () => expect(itemStatus(5, "kg", 10, null)).toBe("select_price_unit"));
  it("kg rate with litre price is a mismatch", () => expect(itemStatus(5, "kg", 10, "l")).toBe("unit_mismatch"));
  it("kg rate with bag price is compatible", () => expect(itemStatus(5, "kg", 10, "25 kg bag")).toBe("ok"));
  it("negative values are invalid", () => {
    expect(itemStatus(-1, "kg", 10, "kg")).toBe("invalid_value");
    expect(itemStatus(1, "kg", -10, "kg")).toBe("invalid_value");
    expect(itemStatus(Number.NaN, "kg", 10, "kg")).toBe("invalid_value");
  });
});

describe("empty and incomplete budgets", () => {
  it("all numeric inputs start blank and nothing is fabricated", () => {
    const r = computeBudget(blankInputs(), [transport(null)]);
    expect(r.status).toBe("not_started");
    expect(r.items[TRANSPORT_ITEM_ID].status).toBe("transport_selection_needed");
    expect(r.main).toBeNull(); expect(r.alt).toBeNull();
    expect(r.tvcPerHa).toBe(0); expect(r.tvcFarm).toBeNull();
    expect(r.categories).toHaveLength(11);
  });
  it("the eleven categories are in workbook order", () => {
    expect(COST_CATEGORIES.map((c) => c.name)).toEqual([
      "Seed", "Fertiliser and lime", "Herbicides", "Insecticides", "Growth regulators", "Labour",
      "Tractor hire and land preparation", "Harvesting", "Transport", "Irrigation", "Other variable costs",
    ]);
  });
  it("incomplete items are flagged, contribute zero and keep the budget in progress", () => {
    const { inputs, items } = scenario();
    items.push(item("irrigation", { name: "Pump", rate: 100, rateUnit: "mm", price: null }));
    const r = computeBudget(inputs, items);
    expect(r.status).toBe("in_progress");
    expect(r.issues.some((i) => i.message.includes("Enter the unit price"))).toBe(true);
    expect(r.categories.find((c) => c.id === "irrigation")!.costPerHa).toBe(0);
  });
  it("missing rate, unit price, or selected units identify the started cost item", () => {
    const { inputs, items } = scenario();
    const rateMissing = item("other", { name: "Seed treatment" });
    const unitPriceMissing = item("other", { name: "Spray", rate: 3, rateUnit: "l", price: null });
    const unitMissing = item("other", { name: "Fertiliser", rate: 2, price: 100, priceUnit: "kg" });
    const r = computeBudget(inputs, [...items, rateMissing, unitPriceMissing, unitMissing]);
    expect(r.items[rateMissing.id].status).toBe("enter_rate");
    expect(r.items[unitPriceMissing.id].status).toBe("price_needed");
    expect(r.items[unitMissing.id].status).toBe("select_unit");
    expect(r.status).toBe("in_progress");
  });
  it.each([
    ["acres", "Seed treatment: Enter the quantity or rate per acre."],
    ["ha", "Seed treatment: Enter the quantity or rate per ha."],
  ] as const)("uses the selected land unit in rate validation for %s", (areaUnit, expectedMessage) => {
    const rateMissing = item("other", { name: "Seed treatment" });
    const r = computeBudget({ ...blankInputs(), areaUnit }, [rateMissing]);
    const issue = r.issues.find((entry) => entry.field === `item:${rateMissing.id}`);
    expect(issue?.message).toBe("Seed treatment: Enter the quantity or rate.");
    expect(formatAreaUnitMessage(issue!.message, areaUnit)).toBe(expectedMessage);
  });
  it("incompatible units never enter the calculation", () => {
    const { inputs, items } = scenario();
    const bad = item("other", { rate: 3, rateUnit: "kg", price: 100, priceUnit: "l" });
    const r = computeBudget(inputs, [...items, bad]);
    expect(r.items[bad.id].status).toBe("unit_mismatch");
    expect(r.items[bad.id].costPerHa).toBe(0);
    expect(r.status).toBe("in_progress");
  });
  it("an unused empty item does not block completion", () => {
    const { inputs, items } = scenario();
    const r = computeBudget(inputs, [...items, item("other")]);
    expect(r.status).toBe("ready");
  });
  it("a farm-gate budget with only unused cost rows can be ready", () => {
    const { inputs } = scenario();
    const r = computeBudget({ ...inputs, transportArrangement: "farm_gate" }, [transport(null)]);
    expect(r.status).toBe("ready");
  });
  it("negative area / yield / price are errors and give no results", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, area: -1, yieldMain: -2, price: -5 }, items);
    expect(r.issues.filter((i) => i.severity === "error").length).toBe(3);
    expect(r.main).toBeNull(); expect(r.status).toBe("in_progress");
  });
  it("a negative cost-item value is identified and blocks readiness", () => {
    const { inputs, items } = scenario();
    const negative = item("other", { name: "Fuel", rate: -2, rateUnit: "l", price: 10, priceUnit: "l" });
    const r = computeBudget(inputs, [...items, negative]);
    expect(r.items[negative.id].status).toBe("invalid_value");
    expect(r.status).toBe("in_progress");
  });
  it("zero yield: no division by zero, break-even is n/a", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, yieldMain: 0 }, items);
    expect(r.main).toBeNull();
    const r2 = computeBudget({ ...inputs, yieldAlt: 0 }, items);
    expect(r2.alt!.breakEvenPerKg).toBeNull(); expect(r2.alt!.productionKgHa).toBe(0);
  });
  it("zero total variable costs: return is n/a, percentages are 0", () => {
    const { inputs } = scenario();
    const r = computeBudget(inputs, [transport(null)]);
    expect(r.main!.returnPerMwk).toBeNull();
    expect(r.categories.every((c) => c.pctOfTotal === 0)).toBe(true);
  });
  it("whole-farm values are n/a when area is missing, per-ha still works", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, area: null }, items);
    expect(r.main!.grossIncomeFarm).toBeNull(); expect(r.main!.grossIncomePerHa).toBeGreaterThan(0);
    expect(r.status).toBe("in_progress");
  });
  it("acres are converted to hectares internally", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, area: 10, areaUnit: "acres" }, items);
    expect(r.areaHa!).toBeCloseTo(4.0469, 4);
    expect(r.areaAcres!).toBeCloseTo(10, 9);
  });
  it("same physical farm and per-area quantity produce equivalent whole-farm costs", () => {
    const seedHa = item("seed", { name: "Seed", rate: 25, rateUnit: "kg", price: 1000, priceUnit: "kg" });
    const seedAcreRate = areaRequirementToHa(areaRequirementPerUnit(25, "acres"), "acres");
    const seedAcre = { ...seedHa, id: "seed-acre", rate: seedAcreRate };
    const base = computeBudget({ ...blankInputs(), area: 10, areaUnit: "ha", transportArrangement: "farm_gate" }, [seedHa]);
    const switched = computeBudget({ ...blankInputs(), area: 10 * 2.47105, areaUnit: "acres", transportArrangement: "farm_gate" }, [seedAcre]);
    expect(switched.tvcFarm).toBeCloseTo(base.tvcFarm!, 6);
  });
  it("acre-based rates and prices calculate correctly without changing whole-farm cost", () => {
    const acres = 2;
    const perAcre = item("tractor", {
      name: "Land preparation",
      rate: areaRequirementToHa(1, "acres"),
      rateUnit: "acre",
      price: 500,
      priceUnit: "acre",
    });
    const perHectare = item("tractor", {
      name: "Land preparation",
      rate: 1,
      rateUnit: "ha",
      price: 500 * 2.47105,
      priceUnit: "ha",
    });

    const acreResult = computeBudget({ ...blankInputs(), area: acres, areaUnit: "acres" }, [perAcre]);
    const hectareResult = computeBudget({ ...blankInputs(), area: acres / 2.47105, areaUnit: "ha" }, [perHectare]);

    expect(acreResult.items[perAcre.id].costPerHa).toBeCloseTo(500 * 2.47105, 6);
    expect(acreResult.items[perAcre.id].costFarm).toBeCloseTo(1000, 6);
    expect(acreResult.tvcFarm).toBeCloseTo(hectareResult.tvcFarm!, 6);
  });
});

describe("required farm setup validation", () => {
  it("missing farm area is reported and prevents readiness", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, area: null }, items);
    expect(r.issues.some((issue) => issue.field === "area" && issue.severity === "warning")).toBe(true);
    expect(r.status).toBe("in_progress");
  });
  it("missing farm area unit is reported and prevents whole-farm completion", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, areaUnit: null }, items);
    expect(r.issues.some((issue) => issue.field === "areaUnit")).toBe(true);
    expect(r.areaHa).toBeNull();
    expect(r.status).toBe("in_progress");
  });
  it("missing main yield is reported and withholds main results", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, yieldMain: null }, items);
    expect(r.issues.some((issue) => issue.field === "yieldMain" && issue.severity === "warning")).toBe(true);
    expect(r.main).toBeNull();
    expect(r.status).toBe("in_progress");
  });
  it("missing selling price is reported and withholds scenarios", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, price: null }, items);
    expect(r.issues.some((issue) => issue.field === "price" && issue.severity === "warning")).toBe(true);
    expect(r.main).toBeNull();
    expect(r.status).toBe("in_progress");
  });
  it("missing selling price unit is reported and withholds scenarios", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, priceUnit: null }, items);
    expect(r.issues.some((issue) => issue.field === "priceUnit")).toBe(true);
    expect(r.main).toBeNull();
    expect(r.status).toBe("in_progress");
  });
  it("alternative yield is optional and its absence does not block a complete budget", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, yieldAlt: null }, items);
    expect(r.alt).toBeNull();
    expect(r.issues.filter((issue) => issue.field === "yieldAlt").every((issue) => issue.severity === "info")).toBe(true);
    expect(r.status).toBe("ready");
  });
});

describe("financial relationships (workbook Checks 19-30)", () => {
  const { inputs, items } = scenario();
  const r = computeBudget(inputs, items);
  const m = r.main!;

  it("reference numbers", () => {
    // seed 75,000 + fert 8*95,000=760,000 + 0.2t*1000... (200 kg @1,000/t = 200) ; herbicide 50 g*800=40,000
    // labour 60,000 ; transport 8 t * 20,000 = 160,000
    expect(r.items[items[0].id].costPerHa).toBeCloseTo(75000, 6);
    expect(r.items[items[1].id].costPerHa).toBeCloseTo(8 * 50 * (95000 / 50), 6);
    expect(r.items[items[2].id].costPerHa).toBeCloseTo(200 * (1000 / 1000), 6);
    expect(r.items[items[3].id].costPerHa).toBeCloseTo(50 * 0.001 * (800 / 0.001), 6);
    expect(r.items[items[5].id].costPerHa).toBeCloseTo(160000, 6);
    expect(r.status).toBe("ready");
  });
  it("whole-farm cost = per-ha cost x area", () => {
    expect(r.tvcFarm!).toBeCloseTo(r.tvcPerHa * r.areaHa!, 6);
    for (const it of items) expect(r.items[it.id].costFarm!).toBeCloseTo(r.items[it.id].costPerHa * r.areaHa!, 6);
  });
  it("gross income = production x price", () => {
    expect(m.grossIncomePerHa).toBeCloseTo(8000 * 500, 6);
    expect(m.grossIncomeFarm!).toBeCloseTo(m.productionKgFarm! * 500, 6);
  });
  it("gross margin = gross income - total variable costs", () => {
    expect(m.grossMarginPerHa).toBeCloseTo(m.grossIncomePerHa - r.tvcPerHa, 6);
    expect(m.grossMarginFarm!).toBeCloseTo(m.grossIncomeFarm! - r.tvcFarm!, 6);
  });
  it("break-even price x production = total variable costs", () => {
    expect(m.breakEvenPerKg! * m.productionKgHa).toBeCloseTo(r.tvcPerHa, 6);
    expect(m.breakEvenPerTonne!).toBeCloseTo(m.breakEvenPerKg! * 1000, 9);
    expect(m.breakEvenPerBag50!).toBeCloseTo(m.breakEvenPerKg! * 50, 9);
    expect(m.variableCostPerKg).toBe(m.breakEvenPerKg);
  });
  it("category subtotals add up to total variable costs", () => {
    expect(r.categories.reduce((s, c) => s + c.costPerHa, 0)).toBeCloseTo(r.tvcPerHa, 6);
    expect(r.categories.reduce((s, c) => s + c.costFarm!, 0)).toBeCloseTo(r.tvcFarm!, 6);
  });
  it("category percentages add to 100%", () => {
    expect(r.categories.reduce((s, c) => s + c.pctOfTotal, 0)).toBeCloseTo(100, 9);
  });
  it("return per MWK = gross income / total variable costs", () => {
    expect(m.returnPerMwk!).toBeCloseTo(m.grossIncomePerHa / r.tvcPerHa, 9);
  });
  it("mass items report tonnes and 50 kg bags for the whole farm", () => {
    const fert = r.items[items[1].id]; // 8 bags x 50 kg x 2 ha = 800 kg
    expect(fert.farmQtyStd).toBeCloseTo(800, 9); expect(fert.farmTonnes!).toBeCloseTo(0.8, 9); expect(fert.farmBags50!).toBeCloseTo(16, 9);
    expect(r.items[items[4].id].farmTonnes).toBeNull(); // labour days: not mass
  });
});

describe("alternative scenario and transport adjustment", () => {
  it("TVC_alt = TVC_main + (alt - main yield) x transport price per kg", () => {
    const { inputs, items } = scenario();
    const r = computeBudget(inputs, items);
    expect(r.transportPricePerKg).toBeCloseTo(20, 9);
    expect(r.alt!.tvcPerHa).toBeCloseTo(r.tvcPerHa + (5000 - 8000) * 20, 6);
    expect(r.alt!.tvcFarm!).toBeCloseTo(r.alt!.tvcPerHa * 2, 6);
  });
  it("equals recomputing the whole budget with the alternative yield as the main yield", () => {
    const { inputs, items } = scenario();
    const viaAdjustment = computeBudget(inputs, items).alt!;
    const direct = computeBudget({ ...inputs, yieldMain: 5 }, items).main!;
    expect(viaAdjustment.tvcPerHa).toBeCloseTo(direct.tvcPerHa, 6);
    expect(viaAdjustment.grossMarginPerHa).toBeCloseTo(direct.grossMarginPerHa, 6);
    expect(viaAdjustment.breakEvenPerKg!).toBeCloseTo(direct.breakEvenPerKg!, 9);
    expect(viaAdjustment.returnPerMwk!).toBeCloseTo(direct.returnPerMwk!, 9);
  });
  it("alternative equals main when both yields are equal", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, yieldAlt: 8 }, items);
    expect(r.alt!.tvcPerHa).toBeCloseTo(r.main!.tvcPerHa, 9);
    expect(r.alt!.grossMarginPerHa).toBeCloseTo(r.main!.grossMarginPerHa, 9);
    expect(r.alt!.returnPerMwk!).toBeCloseTo(r.main!.returnPerMwk!, 9);
  });
  it("transport required with no price is incomplete and adds no transport cost", () => {
    const { inputs, items } = scenario();
    const noTransport = items.map((i) => (i.yieldLinked ? { ...i, price: null } : i));
    const r = computeBudget(inputs, noTransport);
    expect(r.items[TRANSPORT_ITEM_ID].status).toBe("price_needed");
    expect(r.status).toBe("in_progress");
    expect(r.transportPricePerKg).toBe(0);
    expect(r.alt!.tvcPerHa).toBeCloseTo(r.tvcPerHa, 9);
  });
  it("transport price per bag is converted correctly", () => {
    const { inputs, items } = scenario();
    const perBag = items.map((i) => (i.yieldLinked ? { ...i, price: 1000, priceUnit: "50 kg bag" as const } : i));
    expect(computeBudget(inputs, perBag).transportPricePerKg).toBeCloseTo(20, 9);
  });
  it("alternative needs only its own yield and the price - not the main yield", () => {
    const { inputs, items } = scenario();
    const full = computeBudget(inputs, items).alt!;
    const noMain = computeBudget({ ...inputs, yieldMain: null }, items);
    expect(noMain.main).toBeNull();
    expect(noMain.alt !== null).toBe(true);
    expect(noMain.alt!.tvcPerHa).toBeCloseTo(full.tvcPerHa, 6);
    expect(noMain.alt!.grossMarginPerHa).toBeCloseTo(full.grossMarginPerHa, 6);
    expect(noMain.status).toBe("in_progress");
  });
  it("alternative is still withheld without its own yield or without a price", () => {
    const { inputs, items } = scenario();
    expect(computeBudget({ ...inputs, price: null }, items).alt).toBeNull();
    expect(computeBudget({ ...inputs, yieldAlt: null }, items).alt).toBeNull();
  });
  it("spare (non-linked) transport items stay fixed per hectare", () => {
    const { inputs, items } = scenario();
    const extra = item("transport", { rate: 1, rateUnit: "lump sum", price: 10000, priceUnit: "lump sum" });
    const a = computeBudget(inputs, [...items, extra]);
    expect(a.alt!.tvcPerHa).toBeCloseTo(a.tvcPerHa - 3000 * 20, 6);
  });
});

describe("explicit transport arrangements", () => {
  it("no selection keeps an otherwise complete budget incomplete", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, transportArrangement: null }, items);
    expect(r.items[TRANSPORT_ITEM_ID].status).toBe("transport_selection_needed");
    expect(r.issues.some((i) => i.message.includes("Select a transport arrangement"))).toBe(true);
    expect(r.status).toBe("in_progress");
  });
  it("farm-gate sale excludes transport cost without requiring a price", () => {
    const { inputs, items } = scenario();
    const farmGate = items.map((i) => (i.yieldLinked ? { ...i, price: null } : i));
    const r = computeBudget({ ...inputs, transportArrangement: "farm_gate" }, farmGate);
    expect(r.items[TRANSPORT_ITEM_ID].status).toBe("farm_gate");
    expect(r.items[TRANSPORT_ITEM_ID].costPerHa).toBe(0);
    expect(r.transportPricePerKg).toBe(0);
    expect(r.status).toBe("ready");
    expect(r.alt!.tvcPerHa).toBeCloseTo(r.tvcPerHa, 9);
  });
  it("transport required with a valid price includes the main transport cost", () => {
    const { inputs, items } = scenario();
    const r = computeBudget(inputs, items);
    expect(r.items[TRANSPORT_ITEM_ID].status).toBe("ok");
    expect(r.items[TRANSPORT_ITEM_ID].costPerHa).toBeCloseTo(160000, 6);
    expect(r.transportPricePerKg).toBeCloseTo(20, 9);
    expect(r.status).toBe("ready");
  });
  it("a transport price entered before the main yield is flagged", () => {
    const { inputs, items } = scenario();
    const r = computeBudget({ ...inputs, yieldMain: null }, items);
    expect(r.items[TRANSPORT_ITEM_ID].status).toBe("enter_rate");
  });
});
