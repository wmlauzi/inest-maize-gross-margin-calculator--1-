import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { computeBudget } from "../calculations/grossMargin.ts";
import { COST_CATEGORIES, TRANSPORT_ITEM_ID } from "../data/costCategories.ts";
import { AREA_UNITS, PRICE_FACTORS, UNITS, YIELD_FACTORS } from "../data/units.ts";
import type {
  AreaUnit, BudgetInputs, BudgetResult, CategoryId, CostItem, PriceUnit, RateInputMode, TransportArrangement, UnitName, YieldUnit,
} from "../types/index.ts";

export interface State { inputs: BudgetInputs; items: CostItem[]; }
type Action =
  | { t: "input"; patch: Partial<BudgetInputs> }
  | { t: "add"; categoryId: CategoryId }
  | { t: "update"; id: string; patch: Partial<CostItem> }
  | { t: "remove"; id: string }
  | { t: "reset" };

/** Everything numeric starts blank - nothing is prefilled. */
const fresh = (): State => ({
  inputs: { season: "", description: "", area: null, areaUnit: "ha", yieldMain: null, yieldMainUnit: "tonnes per ha",
    yieldAlt: null, yieldAltUnit: "tonnes per ha", price: null, priceUnit: "MWK per kg", transportArrangement: null },
  items: [{ id: TRANSPORT_ITEM_ID, categoryId: "transport", name: "Transport of grain", description: "Quantity follows the main expected yield",
    rate: null, rateUnit: "kg", price: null, priceUnit: "tonne", notes: "", userAdded: false, yieldLinked: true }],
});

const reducer = (s: State, a: Action): State => {
  switch (a.t) {
    case "input": return { ...s, inputs: { ...s.inputs, ...a.patch } };
    case "add": return { ...s, items: [...s.items, { id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      categoryId: a.categoryId, name: "", description: "", rate: null, rateInputMode: "per_area", rateUnit: null, price: null, priceUnit: null, notes: "", userAdded: true }] };
    case "update": return { ...s, items: s.items.map((i) => (i.id === a.id ? { ...i, ...a.patch } : i)) };
    case "remove": return { ...s, items: s.items.filter((i) => i.id !== a.id || !i.userAdded) };
    case "reset": return fresh();
  }
};

const KEY = "inest-gm-v1";
const isTransportArrangement = (value: unknown): value is Exclude<TransportArrangement, null> =>
  value === "farm_gate" || value === "transport_required";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RestoreResult {
  state: State;
  message: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const has = (record: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(record, key);
const isNullableNumber = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value));
export function serializeState(state: State): string {
  return JSON.stringify(state);
}

export function restoreSavedState(raw: string | null): RestoreResult {
  if (raw === null) return { state: fresh(), message: null };

  const invalidMessage = "The saved budget could not be read. It has been left untouched.";
  try {
    const saved: unknown = JSON.parse(raw);
    if (!isRecord(saved) || !isRecord(saved.inputs) || !Array.isArray(saved.items)) {
      return { state: fresh(), message: invalidMessage };
    }

    const source = saved.inputs;
    let recovered = false;
    const readString = (key: string, defaultValue: string): string | null => {
      if (!has(source, key)) {
        recovered = true;
        return defaultValue;
      }
      return typeof source[key] === "string" ? source[key] as string : null;
    };
    const readNumber = (key: string): number | null | undefined => {
      if (!has(source, key)) {
        recovered = true;
        return null;
      }
      return isNullableNumber(source[key]) ? source[key] : undefined;
    };
    const readUnit = <T extends string>(key: string, allowed: readonly T[]): T | null | undefined => {
      if (!has(source, key)) {
        recovered = true;
        return null;
      }
      if (source[key] === null) return null;
      const match = allowed.find((candidate) => candidate === source[key]);
      if (match !== undefined) return match;
      recovered = true;
      return null;
    };

    const season = readString("season", "");
    const description = readString("description", "");
    const area = readNumber("area");
    const areaUnit = readUnit<AreaUnit>("areaUnit", AREA_UNITS);
    const yieldMain = readNumber("yieldMain");
    const yieldMainUnit = readUnit<YieldUnit>("yieldMainUnit", Object.keys(YIELD_FACTORS) as YieldUnit[]);
    const yieldAlt = readNumber("yieldAlt");
    const yieldAltUnit = readUnit<YieldUnit>("yieldAltUnit", Object.keys(YIELD_FACTORS) as YieldUnit[]);
    const price = readNumber("price");
    const priceUnit = readUnit<PriceUnit>("priceUnit", Object.keys(PRICE_FACTORS) as PriceUnit[]);
    if (season === null || description === null || area === undefined || areaUnit === undefined ||
      yieldMain === undefined || yieldMainUnit === undefined || yieldAlt === undefined ||
      yieldAltUnit === undefined || price === undefined || priceUnit === undefined) {
      return { state: fresh(), message: invalidMessage };
    }

    let transportArrangement: TransportArrangement = null;
    if (has(source, "transportArrangement")) {
      const value = source.transportArrangement;
      if (value === null || isTransportArrangement(value)) transportArrangement = value;
      else recovered = true;
    }

    const categoryIds = COST_CATEGORIES.map((category) => category.id);
    const unitNames = UNITS.map((unit) => unit.name);
    const ids = new Set<string>();
    const items: CostItem[] = [];
    for (const rawItem of saved.items) {
      if (!isRecord(rawItem) || typeof rawItem.id !== "string" || rawItem.id.trim() === "" ||
        typeof rawItem.categoryId !== "string" || !categoryIds.includes(rawItem.categoryId as CategoryId)) {
        return { state: fresh(), message: invalidMessage };
      }
      if (ids.has(rawItem.id)) return { state: fresh(), message: invalidMessage };
      ids.add(rawItem.id);
      if (has(rawItem, "name") && typeof rawItem.name !== "string" ||
        has(rawItem, "description") && typeof rawItem.description !== "string" ||
        has(rawItem, "notes") && typeof rawItem.notes !== "string" ||
        has(rawItem, "rate") && !isNullableNumber(rawItem.rate) ||
        has(rawItem, "price") && !isNullableNumber(rawItem.price) ||
        has(rawItem, "userAdded") && typeof rawItem.userAdded !== "boolean" ||
        has(rawItem, "yieldLinked") && typeof rawItem.yieldLinked !== "boolean" ||
        has(rawItem, "rateInputMode") && rawItem.rateInputMode !== "per_area" && rawItem.rateInputMode !== "farm_total") {
        return { state: fresh(), message: invalidMessage };
      }
      const rateUnit = readItemUnit(rawItem, "rateUnit", unitNames, () => { recovered = true; });
      const priceUnitValue = readItemUnit(rawItem, "priceUnit", unitNames, () => { recovered = true; });
      if (rateUnit === undefined || priceUnitValue === undefined) return { state: fresh(), message: invalidMessage };
      if (!has(rawItem, "name") || !has(rawItem, "description") || !has(rawItem, "notes") ||
        !has(rawItem, "rate") || !has(rawItem, "price") || !has(rawItem, "userAdded") ||
        !has(rawItem, "rateUnit") || !has(rawItem, "priceUnit") || !has(rawItem, "yieldLinked")) recovered = true;

      const id = rawItem.id;
      const categoryId = rawItem.categoryId as CategoryId;
      const yieldLinked = id === TRANSPORT_ITEM_ID
        ? true
        : typeof rawItem.yieldLinked === "boolean" ? rawItem.yieldLinked : false;
      if (yieldLinked && categoryId !== "transport") return { state: fresh(), message: invalidMessage };
      if (id === TRANSPORT_ITEM_ID && rawItem.yieldLinked !== true) recovered = true;
      if (id === TRANSPORT_ITEM_ID && rawItem.userAdded === true) recovered = true;
      items.push({
        id,
        categoryId,
        name: typeof rawItem.name === "string" ? rawItem.name : "",
        description: typeof rawItem.description === "string" ? rawItem.description : "",
        rate: isNullableNumber(rawItem.rate) ? rawItem.rate : null,
        rateInputMode: (rawItem.rateInputMode === "farm_total" ? "farm_total" : "per_area") as RateInputMode,
        rateUnit,
        price: isNullableNumber(rawItem.price) ? rawItem.price : null,
        priceUnit: priceUnitValue,
        notes: typeof rawItem.notes === "string" ? rawItem.notes : "",
        userAdded: id === TRANSPORT_ITEM_ID ? false : typeof rawItem.userAdded === "boolean" ? rawItem.userAdded : true,
        yieldLinked,
      });
    }

    if (items.filter((item) => item.yieldLinked).length > 1) return { state: fresh(), message: invalidMessage };
    if (!items.some((item) => item.yieldLinked)) {
      items.unshift(fresh().items[0]);
      recovered = true;
    }
    const state: State = {
      inputs: { season, description, area, areaUnit, yieldMain, yieldMainUnit, yieldAlt, yieldAltUnit, price, priceUnit, transportArrangement },
      items,
    };
    return {
      state,
      message: recovered ? "Some saved details were missing or unrecognized. Available information was restored; review it before continuing." : null,
    };
  } catch {
    return { state: fresh(), message: invalidMessage };
  }
}

export function loadSavedState(storageProvider: () => StorageLike = () => window.localStorage): RestoreResult {
  try {
    return restoreSavedState(storageProvider().getItem(KEY));
  } catch {
    return {
      state: fresh(),
      message: "Your saved budget could not be accessed. Existing data has not been overwritten.",
    };
  }
}

const SAVE_ERROR = "We couldn't save your budget on this device. Your entries remain available in this tab, but may be lost if you close it.";

export function saveSavedState(
  state: State,
  storageProvider: () => StorageLike = () => window.localStorage,
): string | null {
  try {
    storageProvider().setItem(KEY, serializeState(state));
    return null;
  } catch {
    return SAVE_ERROR;
  }
}

export function saveStateIfChanged(
  state: State,
  initialState: State,
  storageProvider: () => StorageLike = () => window.localStorage,
): string | null {
  return state === initialState ? null : saveSavedState(state, storageProvider);
}

function readItemUnit(
  item: Record<string, unknown>, key: string, allowed: readonly string[], markRecovered: () => void,
): UnitName | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(item, key)) {
    markRecovered();
    return null;
  }
  const value = item[key];
  if (value === null) return null;
  if (typeof value === "string" && allowed.includes(value)) return value as UnitName;
  markRecovered();
  return null;
}

type SaveStatus = "saved" | "saving" | "error";
interface Ctx extends State {
  result: BudgetResult;
  dispatch: (a: Action) => void;
  saveStatus: SaveStatus;
  persistenceMessage: string | null;
}
const C = createContext<Ctx>(null as never);
export const useStore = () => useContext(C);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [restored] = useState(loadSavedState);
  const [state, dispatch] = useReducer(reducer, restored.state);
  const initialState = useRef(restored.state);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(restored.message ? "error" : "saved");
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(restored.message);
  const result = useMemo(() => computeBudget(state.inputs, state.items), [state]);
  useEffect(() => {
    if (state === initialState.current) return;
    const persist = () => {
      const message = saveStateIfChanged(state, initialState.current);
      setSaveStatus(message ? "error" : "saved");
      setPersistenceMessage(message);
    };
    setSaveStatus("saving");
    const h = setTimeout(persist, 400);
    const flush = () => persist();
    addEventListener("pagehide", flush);
    return () => { clearTimeout(h); removeEventListener("pagehide", flush); };
  }, [state]);
  return <C.Provider value={{ ...state, result, dispatch, saveStatus, persistenceMessage }}>{children}</C.Provider>;
}
