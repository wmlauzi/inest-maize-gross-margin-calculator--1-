import { describe, expect, it } from "vitest";
import { computeBudget } from "../../calculations/grossMargin.ts";
import { areaRequirementPerUnit, areaRequirementToHa, convertAreaRate } from "../../calculations/conversions.ts";
import { TRANSPORT_ITEM_ID } from "../../data/costCategories.ts";
import { loadSavedState, restoreSavedState, saveSavedState, saveStateIfChanged, serializeState, type State, type StorageLike } from "../store.tsx";
import type { BudgetInputs, CostItem } from "../../types/index.ts";

const inputs = (transportArrangement: BudgetInputs["transportArrangement"]): BudgetInputs => ({
  season: "2026/27",
  description: "Test farm",
  area: 2,
  areaUnit: "ha",
  yieldMain: 8,
  yieldMainUnit: "tonnes per ha",
  yieldAlt: 5,
  yieldAltUnit: "tonnes per ha",
  price: 500,
  priceUnit: "MWK per kg",
  transportArrangement,
});

const transport: CostItem = {
  id: TRANSPORT_ITEM_ID,
  categoryId: "transport",
  name: "Transport of grain",
  description: "",
  rate: null,
  rateUnit: "kg",
  price: 20000,
  priceUnit: "tonne",
  notes: "",
  userAdded: false,
  yieldLinked: true,
};

function memoryStorage(initialValue: string | null) {
  let value = initialValue;
  let writes = 0;
  const storage: StorageLike = {
    getItem: () => value,
    setItem: (_key, next) => { writes++; value = next; },
  };
  return {
    storage,
    get value() { return value; },
    get writes() { return writes; },
  };
}

describe("saved budget restoration", () => {
  it("uses a fresh budget when there is no saved data", () => {
    const disk = memoryStorage(null);
    const restored = loadSavedState(() => disk.storage);
    expect(restored.message).toBeNull();
    expect(restored.state.inputs.transportArrangement).toBeNull();
    expect(restored.state.items.some((item) => item.yieldLinked)).toBe(true);
  });

  it("restores valid saved data without changing user entries", () => {
    const state: State = { inputs: inputs("transport_required"), items: [transport] };
    const restored = restoreSavedState(serializeState(state));
    expect(restored.message).toBeNull();
    expect(restored.state).toEqual(state);
  });

  it("preserves an acre-based cost item when the selected farm-area unit changes", () => {
    const areaItem: CostItem = {
      ...transport,
      id: "area-rate",
      categoryId: "tractor",
      name: "Land preparation",
      rate: 2.47105,
      rateUnit: "acre",
      price: 500,
      priceUnit: "acre",
      yieldLinked: false,
    };
    const acresState: State = {
      inputs: { ...inputs("farm_gate"), area: 2, areaUnit: "acres" },
      items: [transport, areaItem],
    };
    const restored = restoreSavedState(serializeState(acresState));
    const hectaresInputs = { ...restored.state.inputs, area: 2 / 2.47105, areaUnit: "ha" as const };

    expect(restored.state.items[1]).toEqual(areaItem);
    expect(computeBudget(restored.state.inputs, restored.state.items).tvcFarm)
      .toBeCloseTo(computeBudget(hectaresInputs, restored.state.items).tvcFarm!, 6);
  });

  it("saves and reopens a per-acre entry of 10 without display drift", () => {
    const entered = 10;
    const areaItem: CostItem = {
      ...transport, id: "area-rate", categoryId: "tractor", name: "Land preparation",
      rate: convertAreaRate(entered, "per_area", "input_to_storage", 2, "acres"),
      rateInputMode: "per_area", rateUnit: "kg", price: 500, priceUnit: "kg", yieldLinked: false,
    };
    const state: State = { inputs: { ...inputs("farm_gate"), areaUnit: "acres" }, items: [transport, areaItem] };
    const restored = restoreSavedState(serializeState(state));
    expect(restored.state.items[1].rate).toBeCloseTo(24.7105, 9);
    expect(convertAreaRate(restored.state.items[1].rate!, restored.state.items[1].rateInputMode ?? "per_area",
      "storage_to_input", restored.state.inputs.area, "acres")).toBeCloseTo(10, 9);
    expect(restored.state.items[1]).toEqual(areaItem);
  });

  it("persists the farm-total entry mode and restores its total display value", () => {
    const rate = convertAreaRate(100, "farm_total", "input_to_storage", 2, "acres");
    const areaItem: CostItem = { ...transport, id: "total-rate", categoryId: "tractor", rate,
      rateInputMode: "farm_total", rateUnit: "kg", price: 500, priceUnit: "kg", yieldLinked: false };
    const state: State = { inputs: { ...inputs("farm_gate"), areaUnit: "acres" }, items: [transport, areaItem] };
    const restored = restoreSavedState(serializeState(state));
    expect(restored.state.items[1].rateInputMode).toBe("farm_total");
    expect(convertAreaRate(restored.state.items[1].rate!, "farm_total", "storage_to_input", 2, "acres")).toBeCloseTo(100, 9);
  });

  it("loads existing per-hectare rates unchanged and derives the selected display value", () => {
    const areaItem: CostItem = {
      ...transport,
      id: "legacy-area-rate",
      categoryId: "tractor",
      name: "Land preparation",
      rate: 24.7105,
      rateUnit: "kg",
      price: 500,
      priceUnit: "kg",
      yieldLinked: false,
    };
    const state: State = {
      inputs: { ...inputs("farm_gate"), areaUnit: "acres" },
      items: [transport, areaItem],
    };
    const disk = memoryStorage(serializeState(state));
    const restored = loadSavedState(() => disk.storage);

    expect(restored.state.items[1].rate).toBe(24.7105);
    expect(areaRequirementPerUnit(restored.state.items[1].rate!, "acres")).toBe(10);
    expect(saveStateIfChanged(restored.state, restored.state, () => disk.storage)).toBeNull();
    expect(disk.writes).toBe(0);
    expect(disk.value).toBe(serializeState(state));
  });

  it.each(["farm_gate", "transport_required"] as const)("saves and reloads the %s transport selection", (arrangement) => {
    const state: State = { inputs: inputs(arrangement), items: [transport] };
    const disk = memoryStorage(null);
    expect(saveSavedState(state, () => disk.storage)).toBeNull();
    expect(loadSavedState(() => disk.storage).state.inputs.transportArrangement).toBe(arrangement);
  });

  it("leaves malformed JSON untouched and reports a recoverable load message", () => {
    const disk = memoryStorage("{not valid json");
    const restored = loadSavedState(() => disk.storage);
    expect(restored.message).toContain("could not be read");
    expect(disk.value).toBe("{not valid json");
    expect(disk.writes).toBe(0);
    expect(saveStateIfChanged(restored.state, restored.state, () => disk.storage)).toBeNull();
    expect(disk.writes).toBe(0);
  });

  it("recovers available values when required input fields are missing", () => {
    const legacy = inputs("farm_gate");
    const { area: _area, ...inputsWithoutArea } = legacy;
    const restored = restoreSavedState(JSON.stringify({ inputs: inputsWithoutArea, items: [transport] }));
    expect(restored.message).toContain("Some saved details were missing");
    expect(restored.state.inputs.area).toBeNull();
    expect(restored.state.inputs.description).toBe("Test farm");
    expect(restored.state.inputs.transportArrangement).toBe("farm_gate");
  });

  it("reports missing saved data structures without writing a blank budget over them", () => {
    const disk = memoryStorage(JSON.stringify({ inputs: inputs("farm_gate") }));
    const restored = loadSavedState(() => disk.storage);
    expect(restored.message).toContain("could not be read");
    expect(disk.writes).toBe(0);
    expect(disk.value).toBe(JSON.stringify({ inputs: inputs("farm_gate") }));
  });

  it("keeps older budgets without transport selection unresolved", () => {
    const { transportArrangement: _transportArrangement, ...legacyInputs } = inputs("transport_required");
    const restored = restoreSavedState(JSON.stringify({ inputs: legacyInputs, items: [transport] }));
    const result = computeBudget(restored.state.inputs, restored.state.items);
    expect(restored.state.inputs.transportArrangement).toBeNull();
    expect(result.items[TRANSPORT_ITEM_ID].status).toBe("transport_selection_needed");
    expect(result.status).toBe("in_progress");
  });

  it("does not overwrite restored data until the user changes it", () => {
    const state: State = { inputs: inputs("farm_gate"), items: [transport] };
    const disk = memoryStorage(serializeState(state));
    const restored = loadSavedState(() => disk.storage);
    expect(saveStateIfChanged(restored.state, restored.state, () => disk.storage)).toBeNull();
    expect(disk.value).toBe(serializeState(state));
    expect(disk.writes).toBe(0);

    const edited = { ...restored.state, inputs: { ...restored.state.inputs, description: "Updated farm" } };
    expect(saveStateIfChanged(edited, restored.state, () => disk.storage)).toBeNull();
    expect(disk.writes).toBe(1);
    expect(restoreSavedState(disk.value).state.inputs.description).toBe("Updated farm");
  });
});

describe("storage failures", () => {
  it("shows a friendly message when localStorage cannot be read", () => {
    const restored = loadSavedState(() => {
      throw new Error("private browser details");
    });
    expect(restored.message).toContain("could not be accessed");
    expect(restored.message).not.toContain("private browser details");
  });

  it("returns a friendly message when localStorage cannot be written", () => {
    const state: State = { inputs: inputs("farm_gate"), items: [transport] };
    const message = saveSavedState(state, () => ({
      getItem: () => null,
      setItem: () => { throw new Error("quota details"); },
    }));
    expect(message).toContain("couldn't save your budget");
    expect(message).not.toContain("quota details");
  });
});
