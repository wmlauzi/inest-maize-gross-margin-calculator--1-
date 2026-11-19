import { Field, Kpi, Num, StatusChip } from "../components/common";
import Converters from "../components/Converters";
import { useState } from "react";
import { useStore } from "../state/store";
import { COST_CATEGORIES } from "../data/costCategories.ts";
import { UNITS } from "../data/units.ts";
import { areaRequirementPerUnit, convertAreaRate, getUnit } from "../calculations/conversions.ts";
import { getAreaUnitText } from "../lib/areaUnitText.ts";
import { fmt, mwk, pct } from "../lib/format";
import type { AreaUnit, CostItem, TransportArrangement, UnitName } from "../types/index.ts";

const UnitSelect = ({ value, onChange, only, label, invalid, errorId, areaUnit }: {
  value: UnitName | null; onChange: (u: UnitName | null) => void; only?: string; label: string; invalid?: boolean; errorId?: string; areaUnit: AreaUnit;
}) => {
  const selectedAreaUnit = areaUnit === "ha" ? "ha" : "acre";
  return <select aria-label={label} aria-invalid={invalid} aria-describedby={errorId} value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as UnitName | null)}>
    <option value="">Unit…</option>{UNITS.filter((u) => (!only || u.type === only) &&
      (u.type !== "area" || u.name === selectedAreaUnit || u.name === value)).map((u) =>
      <option key={u.name} value={u.name}>{u.type !== "area" ? u.label : u.name === selectedAreaUnit ? selectedAreaUnit : "Existing area unit (review)"}</option>)}</select>;
};

function ItemForm({ item }: { item: CostItem }) {
  const { result: r, dispatch, inputs } = useStore();
  const [touched, setTouched] = useState({ rate: false, price: false });
  const res = r.items[item.id]; const up = (patch: Partial<CostItem>) => dispatch({ t: "update", id: item.id, patch });
  const linked = !!item.yieldLinked;
  const arrangement = inputs.transportArrangement;
  const areaUnit: AreaUnit = inputs.areaUnit ?? "ha";
  const areaUnitText = getAreaUnitText(areaUnit);
  const effectiveRateUnit = item.rateUnit;
  const effectivePriceUnit = item.priceUnit ?? effectiveRateUnit;
  const priceUnitLabel = getUnit(effectivePriceUnit)?.type === "area" && effectivePriceUnit !== (areaUnit === "ha" ? "ha" : "acre")
    ? "existing area unit" : effectivePriceUnit ?? "unit";
  const rt = getUnit(linked ? "kg" : effectiveRateUnit)?.type;
  const std = res.stdUnit;
  const displayStd = getUnit(item.rateUnit)?.type === "area" && item.rateUnit !== (areaUnit === "ha" ? "ha" : "acre")
    ? "existing area unit" : getUnit(item.rateUnit)?.type === "area" ? areaUnitText.unitName : std;
  const areaRequirementValue = (valuePerHa: number) => areaRequirementPerUnit(valuePerHa, areaUnit);
  const inputMode = item.rateInputMode ?? "per_area";
  const displayRate = item.rate === null ? null : convertAreaRate(item.rate, inputMode, "storage_to_input", inputs.area, areaUnit);
  const rateIssue = touched.rate && res.status === "enter_rate" ? areaUnitText.validationMessage
    : touched.rate && res.status === "select_unit" ? `Choose a measurement unit for this rate per ${areaUnitText.unitName}.`
    : touched.rate && res.status === "invalid_value" && item.rate !== null && item.rate < 0 ? "Rate cannot be negative."
    : touched.rate && res.status === "invalid_unit" && !getUnit(item.rateUnit) ? `Choose a valid measurement unit for this rate per ${areaUnitText.unitName}.`
    : touched.rate && res.status === "invalid_factor" && !getUnit(item.rateUnit) ? `Choose a convertible measurement unit for this rate per ${areaUnitText.unitName}.`
    : undefined;
  const priceIssue = touched.price && res.status === "price_needed" ? "Enter a unit price."
    : touched.price && res.status === "select_price_unit" ? "Choose the unit used for this price."
    : touched.price && res.status === "unit_mismatch" ? "Choose a price unit that matches the rate unit type."
    : touched.price && res.status === "invalid_value" && item.price !== null && item.price < 0 ? "Price cannot be negative."
    : touched.price && res.status === "invalid_unit" && getUnit(item.rateUnit) ? "Choose a valid price unit."
    : touched.price && res.status === "invalid_factor" && getUnit(item.rateUnit) ? "Choose a price unit that can be converted."
    : undefined;
  const setArrangement = (value: Exclude<TransportArrangement, null>) =>
    dispatch({ t: "input", patch: { transportArrangement: value } });
  return <div className="item cost-item">
    <div className="cost-item-header">{(res.status === "ok" || res.status === "unused" || res.status === "farm_gate" || touched.rate || touched.price) && <StatusChip status={res.status}
      message={rateIssue ?? priceIssue ?? (res.status === "enter_rate" ? areaUnitText.validationMessage : undefined)} />}
      {item.userAdded && <button className="btn del" onClick={() => { if (confirm("Remove this cost item?")) dispatch({ t: "remove", id: item.id }); }}>Remove item</button>}</div>
    {linked && <div className="field cost-transport-arrangement" role="radiogroup" aria-label="Transport arrangement" aria-required="true"
      aria-invalid={arrangement === null} aria-describedby={arrangement === null ? `transport-arrangement-error-${item.id}` : undefined}>
      <strong>Transport arrangement (required)</strong>
      <label className={`transport-choice cost-transport-choice ${arrangement === "farm_gate" ? "is-selected" : ""}`}>
        <input type="radio" name="transport-arrangement" value="farm_gate" required checked={arrangement === "farm_gate"}
          onChange={() => setArrangement("farm_gate")} style={{ width: "auto", minHeight: 0 }} />
        Farm-gate sale — no transport cost incurred by the farmer.
      </label>
      <label className={`transport-choice cost-transport-choice ${arrangement === "transport_required" ? "is-selected" : ""}`}>
        <input type="radio" name="transport-arrangement" value="transport_required" required checked={arrangement === "transport_required"}
          onChange={() => setArrangement("transport_required")} style={{ width: "auto", minHeight: 0 }} />
        Transport required — transport costs must be entered.
      </label>
      {arrangement === null && <p id={`transport-arrangement-error-${item.id}`} className="err" role="alert">Select a transport arrangement to complete the budget.</p>}
      {arrangement === "farm_gate" && <p className="muted" role="status">No transport cost has been included in this budget.</p>}
      {arrangement === "transport_required" && <p className="muted">Transport rate follows the main expected yield per {areaUnitText.unitName}. Enter a price in a compatible mass unit.</p>}
    </div>}
    <div className="fgrid cost-fields">
      <div className="full"><Field label="Item name" htmlFor={`item-name-${item.id}`}><input id={`item-name-${item.id}`} value={item.name} onChange={(e) => up({ name: e.target.value })} readOnly={linked} placeholder="e.g. Basal fertiliser" /></Field></div>
      {(!linked || arrangement !== "farm_gate") && <>
        <Field label={linked ? `${areaUnitText.rateLabel} (= main expected yield)` : inputMode === "farm_total" ? "Total quantity for my farm" : areaUnitText.rateLabel} htmlFor={`item-rate-${item.id}`}>
          {!linked && <label className="cost-rate-mode-label" htmlFor={`item-rate-mode-${item.id}`}>Rate entry</label>}
          {!linked && <select id={`item-rate-mode-${item.id}`} className="cost-rate-mode" aria-label="Rate entry mode" value={inputMode}
            onChange={(e) => up({ rateInputMode: e.target.value as "per_area" | "farm_total" })}>
            <option value="per_area">Per {areaUnitText.unitName}</option><option value="farm_total">Total for my farm</option>
          </select>}
          <div className="row">
            <Num id={`item-rate-${item.id}`} value={linked
              ? (r.yieldMainKgHa > 0 ? areaRequirementValue(r.yieldMainKgHa) : null)
              : displayRate}
              readOnly={linked} disabled={!linked && inputMode === "farm_total" && !(inputs.area !== null && inputs.area > 0)}
              onBlur={() => setTouched((prev) => ({ ...prev, rate: true }))}
              onChange={(v) => up({
                rate: v === null ? null : convertAreaRate(v, inputMode, "input_to_storage", inputs.area, areaUnit),
              })}
            aria-invalid={!!rateIssue} aria-describedby={rateIssue ? `item-rate-error-${item.id}` : undefined} />
          {linked ? <select disabled aria-label="Rate unit"><option>kg</option></select> : <UnitSelect label="Rate unit" value={effectiveRateUnit} areaUnit={areaUnit} invalid={!!rateIssue}
            errorId={rateIssue ? `item-rate-error-${item.id}` : undefined}
            onChange={(u) => {
              setTouched((prev) => ({ ...prev, rate: true }));
              const oldRateUnit = getUnit(item.rateUnit); const newRateUnit = getUnit(u);
              const oldPriceUnit = getUnit(item.priceUnit);
              const nextPriceUnit = !item.priceUnit || item.priceUnit === item.rateUnit ||
                (newRateUnit?.type && oldPriceUnit?.type && newRateUnit.type !== oldPriceUnit.type) ? u : item.priceUnit;
              const newPriceUnit = getUnit(nextPriceUnit);
              const rate = item.rate !== null && oldRateUnit?.type === "area" && newRateUnit?.type === "area"
                ? item.rate * oldRateUnit.factor / newRateUnit.factor : item.rate;
              const price = item.price !== null && oldPriceUnit?.type === "area" && newPriceUnit?.type === "area"
                ? item.price * newPriceUnit.factor / oldPriceUnit.factor : item.price;
              up({ rateUnit: u, rate, priceUnit: nextPriceUnit, price });
            }} />}</div>
          {!linked && <small className="muted">{inputMode === "farm_total"
            ? "Enter the total quantity for the full farm area."
            : areaUnitText.inputHint}</small>}
          {!linked && inputMode === "farm_total" && !(inputs.area !== null && inputs.area > 0) &&
            <small className="muted">Enter a valid farm area in Farm Setup to use total mode.</small>}
          {rateIssue && <p id={`item-rate-error-${item.id}`} className="err" role="alert">{rateIssue}</p>}</Field>
        <Field label={`Unit price (MWK per ${priceUnitLabel})`} htmlFor={`item-price-${item.id}`}><div className="row"><Num id={`item-price-${item.id}`} value={item.price} onBlur={() => setTouched((prev) => ({ ...prev, price: true }))}
            onChange={(v) => up({ price: v })} aria-invalid={!!priceIssue}
            aria-describedby={priceIssue ? `item-price-error-${item.id}` : undefined} />
          <UnitSelect label="Price is per" value={effectivePriceUnit} only={rt} areaUnit={areaUnit} invalid={!!priceIssue}
            errorId={priceIssue ? `item-price-error-${item.id}` : undefined}
            onChange={(u) => {
              setTouched((prev) => ({ ...prev, price: true }));
              const oldUnit = getUnit(item.priceUnit); const newUnit = getUnit(u);
              const price = item.price !== null && oldUnit?.type === "area" && newUnit?.type === "area"
                ? item.price * newUnit.factor / oldUnit.factor : item.price;
              up({ priceUnit: u, price });
            }} /></div>
          {priceIssue && <p id={`item-price-error-${item.id}`} className="err" role="alert">{priceIssue}</p>}</Field>
      </>}
      <Field label="Description (optional)" htmlFor={`item-description-${item.id}`}><input id={`item-description-${item.id}`} value={item.description} onChange={(e) => up({ description: e.target.value })} /></Field>
      <Field label="Notes (optional)" htmlFor={`item-notes-${item.id}`}><input id={`item-notes-${item.id}`} value={item.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
    </div>
    <div className="calc cost-calculations" aria-label="Calculated cost details">
      <span>Standard rate / {areaUnitText.unitName}: <b>{res.ratePerHaStd ? `${fmt(areaRequirementValue(res.ratePerHaStd), 3)} ${displayStd}` : "–"}</b></span>
      <span>Price/{displayStd ?? "unit"}: <b>{res.counted ? fmt(res.pricePerStdUnit, 4) : "–"}</b></span>
      <span>Cost per {areaUnitText.unitName}: <b>{res.counted ? mwk(areaRequirementValue(res.costPerHa)) : "–"}</b></span>
      <span>Whole-farm cost: <b>{res.counted ? mwk(res.costFarm) : "–"}</b></span>
      <span>Share of total: <b>{res.counted ? pct(res.pctOfTotal) : "–"}</b></span>
      {res.farmTonnes !== null && <span>Approx. whole-farm production: <b>{fmt(res.farmTonnes, 3)} t</b> · <b>{fmt(res.farmBags50, 1)}</b> × 50 kg bags</span>}
      {res.farmQtyStd !== null && res.farmTonnes === null && std && std !== "lump sum" && std !== "mm" && <span>Whole-farm quantity: <b>{fmt(res.farmQtyStd, 2)} {displayStd}</b></span>}
      {inputs.area === null && <span className="muted">Enter farm area for whole-farm figures</span>}</div>
  </div>;
}

export default function ProductionCosts() {
  const { items, result: r, dispatch, inputs } = useStore();
  const areaUnit: AreaUnit = inputs.areaUnit ?? "ha";
  const areaUnitText = getAreaUnitText(areaUnit);
  const areaRequirementValue = (valuePerHa: number) => areaRequirementPerUnit(valuePerHa, areaUnit);
  const countedCostItems = r.categories.reduce((total, category) => total + category.countedItems, 0);
  const problemCostItems = r.categories.reduce((total, category) => total + category.problemItems, 0);
  const canShowCostTotals = r.status === "ready" || countedCostItems > 0;
  const partialTotalMessage = problemCostItems > 0
    ? "Partial total; incomplete cost entries are excluded."
    : "Entered costs only; complete the budget to confirm the total.";
  const noCostTotalMessage = problemCostItems > 0
    ? "No complete cost entries to total yet. Resolve the items needing attention."
    : "No costs entered yet. Complete the budget to confirm a zero total.";
  return <div className="production-costs-page">
    <header className="production-costs-intro">
      <p className="costs-eyebrow">BUDGET SETUP · STEP 2</p>
      <h1>Production Costs</h1>
      <p>Record the variable expenses associated with producing maize. Enter quantities and current prices for the costs you expect to incur.</p>
    </header>
    {inputs.transportArrangement === null && <div className="note" role="alert">Select a transport arrangement in the Transport category before completing this budget.</div>}
    <section className="cost-summary" aria-label="Variable cost summary">
      <Kpi label={`Total variable costs per ${areaUnitText.unitName}`}
        value={canShowCostTotals ? mwk(areaRequirementValue(r.tvcPerHa)) : "Pending"}
        sub={r.status === "ready" ? undefined : canShowCostTotals
          ? <span className="cost-total-status is-partial">{partialTotalMessage}</span>
          : <span className="cost-total-status">{noCostTotalMessage}</span>} />
      <Kpi label="Total whole-farm variable costs"
        value={canShowCostTotals && r.tvcFarm !== null ? mwk(r.tvcFarm) : "Pending"}
        sub={r.status === "ready" ? undefined : !canShowCostTotals ? noCostTotalMessage
          : r.tvcFarm === null ? "Enter a valid farm area to calculate the whole-farm total."
            : <span className="cost-total-status is-partial">{partialTotalMessage}</span>} />
    </section>
    <section className="cost-category-section" aria-labelledby="cost-category-heading">
      <div className="cost-category-intro">
        <div><p className="costs-eyebrow">COST BREAKDOWN</p><h2 id="cost-category-heading">Variable cost categories</h2></div>
        <p>Open a category to enter or review its cost items. Unused items do not affect your budget.</p>
      </div>
    {COST_CATEGORIES.map((c, n) => { const cr = r.categories[n]; const mine = items.filter((i) => i.categoryId === c.id);
      const stateLabel = cr.problemItems > 0 ? "Needs attention" : cr.countedItems > 0 ? "Complete" : cr.itemCount > 0 ? "Review item" : "No costs entered";
      const stateClass = cr.problemItems > 0 ? "c-warn" : cr.countedItems > 0 ? "c-ok" : cr.itemCount > 0 ? "c-warn" : "c-n";
      return <details className={`cat cost-category ${cr.problemItems > 0 ? "has-problems" : ""}`} key={c.id}>
        <summary className="cost-category-summary">
          <span className="cost-category-name"><span className="cost-category-number">{String(n + 1).padStart(2, "0")}</span><span>{c.name}</span></span>
          <span className="cost-category-meta">
            <span className={`chip cost-category-status ${stateClass}`}>{stateLabel}</span>
            <span className="cost-category-count">{cr.itemCount} item{cr.itemCount === 1 ? "" : "s"}{cr.problemItems > 0 ? ` · ${cr.problemItems} need attention` : ""}</span>
            <strong className="cost-category-total">{cr.countedItems ? `${mwk(areaRequirementValue(cr.costPerHa))}/${areaUnitText.unitName}` : "–"}</strong>
          </span>
        </summary>
        <div className="body cost-category-body">{mine.map((i) => <ItemForm key={i.id} item={i} />)}
          <button className="btn sec cost-add-item" onClick={() => dispatch({ t: "add", categoryId: c.id })}>+ Add item</button></div>
      </details>; })}
    </section>
    <section className="cost-converters" aria-labelledby="cost-converters-heading">
      <div className="cost-category-intro">
        <div><p className="costs-eyebrow">REFERENCE TOOLS</p><h2 id="cost-converters-heading">Converters</h2></div>
        <p>These helpers do not change your budget.</p>
      </div>
      <Converters />
    </section>
  </div>;
}
