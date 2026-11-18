import { Field, Kpi, Num, StatusChip } from "../components/common";
import Converters from "../components/Converters";
import { useStore } from "../state/store";
import { COST_CATEGORIES } from "../data/costCategories.ts";
import { UNITS } from "../data/units.ts";
import { areaRequirementPerUnit, areaRequirementToHa, getUnit } from "../calculations/conversions.ts";
import { fmt, mwk, pct } from "../lib/format";
import type { CostItem, TransportArrangement, UnitName } from "../types/index.ts";

const UnitSelect = ({ value, onChange, only, label, invalid, errorId }: {
  value: UnitName | null; onChange: (u: UnitName | null) => void; only?: string; label: string; invalid?: boolean; errorId?: string;
}) =>
  <select aria-label={label} aria-invalid={invalid} aria-describedby={errorId} value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as UnitName | null)}>
    <option value="">Unit…</option>{UNITS.filter((u) => !only || u.type === only).map((u) => <option key={u.name} value={u.name}>{u.label}</option>)}</select>;

function ItemForm({ item }: { item: CostItem }) {
  const { result: r, dispatch, inputs } = useStore();
  const res = r.items[item.id]; const up = (patch: Partial<CostItem>) => dispatch({ t: "update", id: item.id, patch });
  const linked = !!item.yieldLinked; const rt = getUnit(linked ? "kg" : item.rateUnit)?.type;
  const std = res.stdUnit;
  const arrangement = inputs.transportArrangement;
  const areaUnit = inputs.areaUnit ?? "ha";
  const areaRequirementLabel = areaUnit === "acres" ? "acre" : "ha";
  const areaRequirementValue = (valuePerHa: number) => areaRequirementPerUnit(valuePerHa, areaUnit);
  const rateIssue = res.status === "enter_rate" ? `Enter the quantity or rate per ${areaRequirementLabel}.`
    : res.status === "select_unit" ? "Choose a unit for this rate."
    : res.status === "invalid_value" && item.rate !== null && item.rate < 0 ? "Rate cannot be negative."
    : res.status === "invalid_unit" && !getUnit(item.rateUnit) ? "Choose a valid rate unit."
    : res.status === "invalid_factor" && !getUnit(item.rateUnit) ? "Choose a rate unit that can be converted."
    : undefined;
  const priceIssue = res.status === "price_needed" ? "Enter a unit price."
    : res.status === "select_price_unit" ? "Choose the unit used for this price."
    : res.status === "unit_mismatch" ? "Choose a price unit that matches the rate unit type."
    : res.status === "invalid_value" && item.price !== null && item.price < 0 ? "Price cannot be negative."
    : res.status === "invalid_unit" && getUnit(item.rateUnit) ? "Choose a valid price unit."
    : res.status === "invalid_factor" && getUnit(item.rateUnit) ? "Choose a price unit that can be converted."
    : undefined;
  const setArrangement = (value: Exclude<TransportArrangement, null>) =>
    dispatch({ t: "input", patch: { transportArrangement: value } });
  return <div className="item cost-item">
    <div className="cost-item-header"><StatusChip status={res.status} />
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
      {arrangement === "transport_required" && <p className="muted">Transport rate follows the main expected yield per {areaRequirementLabel}. Enter a price in a compatible mass unit.</p>}
    </div>}
    <div className="fgrid cost-fields">
      <div className="full"><Field label="Item name" htmlFor={`item-name-${item.id}`}><input id={`item-name-${item.id}`} value={item.name} onChange={(e) => up({ name: e.target.value })} readOnly={linked} placeholder="e.g. Basal fertiliser" /></Field></div>
      {(!linked || arrangement !== "farm_gate") && <>
        <Field label={linked ? `Rate per ${areaRequirementLabel} (= main expected yield)` : `Rate per ${areaRequirementLabel}`} htmlFor={`item-rate-${item.id}`}><div className="row">
            <Num id={`item-rate-${item.id}`} value={linked
              ? (r.yieldMainKgHa > 0 ? areaRequirementValue(r.yieldMainKgHa) : null)
              : (item.rate === null ? null : areaRequirementValue(item.rate))}
              readOnly={linked} onChange={(v) => up({ rate: v === null ? null : areaRequirementToHa(v, areaUnit) })}
            aria-invalid={!!rateIssue} aria-describedby={rateIssue ? `item-rate-error-${item.id}` : undefined} />
          {linked ? <select disabled aria-label="Rate unit"><option>kg</option></select> : <UnitSelect label="Rate unit" value={item.rateUnit} invalid={!!rateIssue}
            errorId={rateIssue ? `item-rate-error-${item.id}` : undefined} onChange={(u) => { const t = getUnit(u)?.type; const pt = getUnit(item.priceUnit)?.type; up({ rateUnit: u, priceUnit: !item.priceUnit || (t && pt && t !== pt) ? u : item.priceUnit }); }} />}</div>
          {rateIssue && <p id={`item-rate-error-${item.id}`} className="err" role="alert">{rateIssue}</p>}</Field>
        <Field label="Unit price (MWK)" htmlFor={`item-price-${item.id}`}><div className="row"><Num id={`item-price-${item.id}`} value={item.price} onChange={(v) => up({ price: v })}
            aria-invalid={!!priceIssue} aria-describedby={priceIssue ? `item-price-error-${item.id}` : undefined} />
          <UnitSelect label="Price is per" value={item.priceUnit} only={rt} invalid={!!priceIssue} errorId={priceIssue ? `item-price-error-${item.id}` : undefined} onChange={(u) => up({ priceUnit: u })} /></div>
          {priceIssue && <p id={`item-price-error-${item.id}`} className="err" role="alert">{priceIssue}</p>}</Field>
      </>}
      <Field label="Description (optional)" htmlFor={`item-description-${item.id}`}><input id={`item-description-${item.id}`} value={item.description} onChange={(e) => up({ description: e.target.value })} /></Field>
      <Field label="Notes (optional)" htmlFor={`item-notes-${item.id}`}><input id={`item-notes-${item.id}`} value={item.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
    </div>
    <div className="calc cost-calculations" aria-label="Calculated cost details">
      <span>Standard rate / {areaRequirementLabel}: <b>{res.ratePerHaStd ? `${fmt(areaRequirementValue(res.ratePerHaStd), 3)} ${std}` : "–"}</b></span>
      <span>Price/{std ?? "unit"}: <b>{res.counted ? fmt(res.pricePerStdUnit, 4) : "–"}</b></span>
      <span>Cost per {areaRequirementLabel}: <b>{res.counted ? mwk(areaRequirementValue(res.costPerHa)) : "–"}</b></span>
      <span>Whole-farm cost: <b>{res.counted ? mwk(res.costFarm) : "–"}</b></span>
      <span>Share of total: <b>{res.counted ? pct(res.pctOfTotal) : "–"}</b></span>
      {res.farmTonnes !== null && <span>Approx. whole-farm production: <b>{fmt(res.farmTonnes, 3)} t</b> · <b>{fmt(res.farmBags50, 1)}</b> × 50 kg bags</span>}
      {res.farmQtyStd !== null && res.farmTonnes === null && std && std !== "lump sum" && std !== "mm" && <span>Whole-farm quantity: <b>{fmt(res.farmQtyStd, 2)} {std}</b></span>}
      {inputs.area === null && <span className="muted">Enter farm area for whole-farm figures</span>}</div>
  </div>;
}

export default function ProductionCosts() {
  const { items, result: r, dispatch, inputs } = useStore();
  const areaUnit = inputs.areaUnit ?? "ha";
  const areaRequirementLabel = areaUnit === "acres" ? "acre" : "ha";
  const areaRequirementValue = (valuePerHa: number) => areaRequirementPerUnit(valuePerHa, areaUnit);
  return <div className="production-costs-page">
    <header className="production-costs-intro">
      <p className="costs-eyebrow">BUDGET SETUP · STEP 2</p>
      <h1>Production Costs</h1>
      <p>Record the variable expenses associated with producing maize. Enter quantities and current prices for the costs you expect to incur.</p>
    </header>
    {inputs.transportArrangement === null && <div className="note" role="alert">Select a transport arrangement in the Transport category before completing this budget.</div>}
    <section className="cost-summary" aria-label="Variable cost summary">
      <Kpi label={`Total variable costs per ${areaRequirementLabel}`} value={mwk(areaRequirementValue(r.tvcPerHa))} />
      <Kpi label="Total whole-farm variable costs" value={mwk(r.tvcFarm)} sub={r.tvcFarm === null ? "Whole-farm total unavailable until farm area is entered" : undefined} />
    </section>
    <section className="cost-category-section" aria-labelledby="cost-category-heading">
      <div className="cost-category-intro">
        <div><p className="costs-eyebrow">COST BREAKDOWN</p><h2 id="cost-category-heading">Variable cost categories</h2></div>
        <p>Open a category to enter or review its cost items. Unused items do not affect your budget.</p>
      </div>
    {COST_CATEGORIES.map((c, n) => { const cr = r.categories[n]; const mine = items.filter((i) => i.categoryId === c.id);
      const stateLabel = cr.problemItems > 0 ? "Needs attention" : cr.countedItems > 0 ? "Complete" : mine.length > 0 ? "Review item" : "No costs entered";
      const stateClass = cr.problemItems > 0 ? "c-warn" : cr.countedItems > 0 ? "c-ok" : mine.length > 0 ? "c-warn" : "c-n";
      return <details className={`cat cost-category ${cr.problemItems > 0 ? "has-problems" : ""}`} key={c.id}>
        <summary className="cost-category-summary">
          <span className="cost-category-name"><span className="cost-category-number">{String(n + 1).padStart(2, "0")}</span><span>{c.name}</span></span>
          <span className="cost-category-meta">
            <span className={`chip cost-category-status ${stateClass}`}>{stateLabel}</span>
            <span className="cost-category-count">{cr.itemCount} item{cr.itemCount === 1 ? "" : "s"}{cr.problemItems > 0 ? ` · ${cr.problemItems} need attention` : ""}</span>
            <strong className="cost-category-total">{cr.countedItems ? `${mwk(areaRequirementValue(cr.costPerHa))}/${areaRequirementLabel}` : "–"}</strong>
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
