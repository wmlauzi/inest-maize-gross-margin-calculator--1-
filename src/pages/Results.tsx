import { GM_NOTE } from "../components/common";
import { areaRequirementPerUnit } from "../calculations/conversions";
import { formatAreaUnitMessage, getAreaUnitText } from "../lib/areaUnitText.ts";
import { useStore } from "../state/store";
import { fmt, mwk, pct } from "../lib/format";
import type { PageId } from "../App";
import type { AreaUnit, ScenarioResult } from "../types/index.ts";

export function Missing({ go }: { go: (p: PageId) => void }) {
  const { result: r, inputs } = useStore();
  const areaUnit: AreaUnit = inputs.areaUnit ?? "ha";
  const todo = r.issues.filter((i) => i.severity !== "info");
  return <section className="results-missing" aria-labelledby="results-missing-heading">
    <p className="results-eyebrow">INCOMPLETE BUDGET</p>
    <h2 id="results-missing-heading">Complete the required inputs before reviewing results</h2>
    {todo.length > 0
      ? <ul>{todo.map((i, k) => <li key={`${i.field}-${k}`}>{formatAreaUnitMessage(i.message, areaUnit)}</li>)}</ul>
      : <p>No main scenario is available yet. Enter the required farm assumptions to calculate it.</p>}
    {r.alt === null && <p className="results-empty-note">Alternative scenario unavailable. It is optional and will appear when a valid alternative yield is entered.</p>}
    <button className="btn" onClick={() => go("farm")}>Go to Farm Setup</button>
  </section>;
}

export default function Results({ go }: { go: (p: PageId) => void }) {
  const { inputs, result: r } = useStore();
  const m = r.main;
  const a = r.alt;
  const areaUnit: AreaUnit = inputs.areaUnit ?? "ha";
  const areaUnitText = getAreaUnitText(areaUnit);
  const areaUnitLabel = areaUnitText.unitName;
  const areaValue = inputs.area === null ? "Not entered" : `${fmt(inputs.area)} ${areaUnitText.pluralUnitName}`;
  const countedItems = r.categories.reduce((total, category) => total + category.countedItems, 0);
  const hasCostTotals = r.status === "ready" || countedItems > 0;
  const hasIncompleteCosts = r.categories.some((category) => category.problemItems > 0);
  const neg = !!m && m.grossMarginPerHa < 0;
  const rows: [string, (s: ScenarioResult) => string][] = [
    [`Expected production (kg/${areaUnitText.unitName})`, (s) => fmt(areaRequirementPerUnit(s.productionKgHa, areaUnit), 0)],
    ["Whole-farm production (tonnes)", (s) => fmt(s.productionTonnesFarm, 2)],
    ["Gross income, whole farm", (s) => mwk(s.grossIncomeFarm)],
    ["Total variable costs, whole farm", (s) => hasCostTotals ? mwk(s.tvcFarm) : "Pending — no complete cost items"],
    ["Gross margin, whole farm", (s) => mwk(s.grossMarginFarm)],
    [`Gross margin per ${areaUnitLabel}`, (s) => mwk(areaRequirementPerUnit(s.grossMarginPerHa, areaUnit))],
    ["Break-even price (MWK/kg)", (s) => fmt(s.breakEvenPerKg, 2)],
    ["Return per MWK of variable costs", (s) => fmt(s.returnPerMwk, 2)],
  ];
  const colM = (f: (s: ScenarioResult) => string) => m ? f(m) : "—";
  const colA = (f: (s: ScenarioResult) => string) => a ? f(a) : "—";
  const max = Math.max(...r.categories.map((category) => category.costPerHa), 1);
  const maxMarginMagnitude = Math.max(Math.abs(m?.grossMarginFarm ?? 0), Math.abs(a?.grossMarginFarm ?? 0), 1);
  const statusLabel = r.status === "ready" ? "Budget ready for review" : r.status === "in_progress" ? "Provisional results" : "Incomplete results";
  const statusClass = r.status === "ready" ? "c-ok" : r.status === "in_progress" ? "c-warn" : "c-n";
  const outputScenario = m ?? a;
  const outputLabel = m ? "Main scenario output" : a ? "Alternative-only output" : "Expected output";
  const outputValue = outputScenario ? `${fmt(outputScenario.productionTonnesFarm, 2)} tonnes` : "Pending";
  const selectedArea = inputs.area;
  const selectedAreaText = selectedArea === null ? areaValue : `${fmt(selectedArea)} ${areaUnitText.pluralUnitName}`;
  const scenarioCostStatus = r.status === "ready"
    ? "Complete budget"
    : countedItems > 0
      ? "Partial total · incomplete entries excluded"
      : "Pending · no complete cost items";

  return <div className="results-page">
    <header className="results-intro">
      <div className="results-intro-copy">
        <p className="results-eyebrow">FINANCIAL SUMMARY</p>
        <h1>Calculation Results &amp; Financial Performance</h1>
        <p>Review the calculated maize budget, scenario assumptions and variable-cost distribution using the values entered in this budget.</p>
      </div>
      <div className="results-scope" aria-label="Report scope">
        <div><span>Currency</span><strong>MWK</strong></div>
        <div><span>Farm area</span><strong>{selectedAreaText}</strong></div>
        <div><span>{outputLabel}</span><strong>{outputValue}</strong></div>
        <span className={`chip results-status ${statusClass}`}>{statusLabel}</span>
      </div>
    </header>

    {r.status !== "ready" && <div className="results-provisional" role="status">
      <strong>These figures are provisional.</strong>
      <span> Only complete cost entries are included in calculated costs; unresolved or incomplete entries can change the results.</span>
      {r.issues.some((issue) => issue.severity !== "info") && <ul>{r.issues.filter((issue) => issue.severity !== "info").map((issue, index) =>
        <li key={`${issue.field}-${index}`}>{formatAreaUnitMessage(issue.message, areaUnit)}</li>)}</ul>}
    </div>}

    {m ? <section className={`results-main-financial ${neg ? "is-negative" : ""}`} aria-labelledby="main-gross-margin-heading">
      <div className="results-gross-margin">
        <p id="main-gross-margin-heading">Main scenario · gross margin</p>
        <strong>{mwk(m.grossMarginFarm)} <span>whole farm</span></strong>
        <small>{mwk(areaRequirementPerUnit(m.grossMarginPerHa, areaUnit))} per {areaUnitLabel}</small>
        <div className="results-gm-note">{GM_NOTE}</div>
      </div>
      <div className="results-financial-grid">
        <div className="kpi kpi-card">
          <span className="l">Expected revenue</span>
          <strong className="v">{mwk(m.grossIncomeFarm)}</strong>
          <span className="s">{mwk(areaRequirementPerUnit(m.grossIncomePerHa, areaUnit))} per {areaUnitLabel}</span>
        </div>
        <div className="kpi kpi-card">
          <span className="l">Total variable costs</span>
          <strong className="v">{hasCostTotals ? mwk(m.tvcFarm) : "Pending"}</strong>
          <span className="s">{scenarioCostStatus}</span>
        </div>
        <div className="kpi kpi-card">
          <span className="l">Break-even selling price</span>
          <strong className="v">{hasCostTotals ? `MWK ${fmt(m.breakEvenPerKg, 2)} /kg` : "Pending"}</strong>
          <span className="s">MWK {fmt(m.breakEvenPerTonne, 0)}/tonne · MWK {fmt(m.breakEvenPerBag50, 0)}/50 kg bag</span>
        </div>
        <div className="kpi kpi-card">
          <span className="l">Return per MWK of variable costs</span>
          <strong className="v">{hasCostTotals ? fmt(m.returnPerMwk, 2) : "Pending"}</strong>
          <span className="s">Gross income ÷ total variable costs</span>
        </div>
      </div>
    </section> : <div className="results-missing-main">
      No main scenario is available. {a ? "Alternative-only figures below are provisional and do not confirm the main budget." : "Enter a main expected yield and selling price in Farm Setup to calculate the budget."}
    </div>}

    <section className="results-assumptions" aria-labelledby="results-assumptions-heading">
      <div className="results-section-heading">
        <div><p className="results-eyebrow">INPUT ASSUMPTIONS</p><h2 id="results-assumptions-heading">Main scenario assumptions</h2></div>
      </div>
      <div className="results-assumption-grid">
        <div><span>Farm area</span><strong>{areaValue}</strong><small>{selectedArea !== null ? `${fmt(areaUnit === "ha" ? r.areaAcres : r.areaHa)} ${areaUnitText.equivalentUnitName} equivalent` : "Area equivalent unavailable"}</small></div>
        <div><span>Main expected yield</span><strong>{m ? `${fmt(areaRequirementPerUnit(m.yieldKgHa, areaUnit), 0)} kg/${areaUnitLabel}` : "Not entered"}</strong><small>{inputs.yieldMainUnit ?? "Yield unit not selected"}</small></div>
        <div><span>Expected selling price</span><strong>{r.pricePerKg > 0 ? `MWK ${fmt(r.pricePerKg, 2)} /kg` : "Not entered"}</strong><small>{inputs.priceUnit ?? "Price unit not selected"}</small></div>
        <div><span>Expected production</span><strong>{m ? `${fmt(areaRequirementPerUnit(m.productionKgHa, areaUnit), 0)} kg/${areaUnitLabel}` : "Not entered"}</strong><small>{m && m.productionKgFarm !== null ? `${fmt(m.productionKgFarm, 0)} kg whole farm` : "Whole-farm production unavailable"}</small></div>
      </div>
    </section>

    <div className="results-analysis-grid">
      <section className="results-comparison" aria-labelledby="results-comparison-heading">
        <div className="results-section-heading">
          <div><p className="results-eyebrow">SCENARIO COMPARISON</p><h2 id="results-comparison-heading">Main vs alternative yield</h2></div>
        </div>
        {!a ? <p className="results-empty-note">Alternative scenario unavailable. It is optional; enter an alternative yield to see the comparison.</p> : <>
          <div className="table-scroll" role="region" aria-label="Main and alternative scenario comparison" tabIndex={0}>
            <table className="results-comparison-table">
              <thead><tr><th scope="col">Financial measure</th><th scope="col">Main{m ? ` (${fmt(areaRequirementPerUnit(m.yieldKgHa, areaUnit), 0)} kg/${areaUnitLabel})` : " (not entered)"}</th><th scope="col">Alternative ({fmt(areaRequirementPerUnit(a.yieldKgHa, areaUnit), 0)} kg/${areaUnitLabel})</th></tr></thead>
              <tbody>{rows.map(([label, format]) => <tr key={label}><th scope="row">{label}</th><td>{colM(format)}</td><td>{colA(format)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="results-comparison-note">Existing calculation results are shown for each scenario. Transport costs adjust with the yield difference when transport is required.</p>
          <div className="results-margin-chart" aria-label="Whole-farm gross margin comparison">
            <p>Whole-farm gross margin comparison</p>
            {[...(m ? [{ label: "Main scenario", scenario: m, tone: "main" }] : []), ...(a ? [{ label: m ? "Alternative scenario" : "Alternative-only scenario", scenario: a, tone: "alternative" }] : [])].map(({ label, scenario, tone }) => {
              const margin = scenario.grossMarginFarm;
              const width = margin === null ? 0 : (Math.abs(margin) / maxMarginMagnitude) * 100;
              return <div className="results-margin-bar" key={label}>
                <div><span>{label}</span><strong>{mwk(margin)}</strong></div>
                <div className={`results-margin-track ${margin !== null && margin < 0 ? "is-negative" : ""}`} role="img" aria-label={`${label} gross margin ${mwk(margin)}`}>
                  <i className={`is-${tone}`} style={{ width: `${width}%` }} />
                </div>
              </div>;
            })}
          </div>
          <p className="results-gm-note">{GM_NOTE}</p>
        </>}
      </section>

      <section className="results-costs" aria-labelledby="results-costs-heading">
        <div className="results-section-heading">
          <div><p className="results-eyebrow">VARIABLE COSTS</p><h2 id="results-costs-heading">Cost distribution breakdown</h2></div>
          <span className="results-category-count">11 categories</span>
        </div>
        {hasCostTotals ? <>
          <div className="results-cost-total">
            <div><span>{r.status === "ready" ? "Allocated total" : "Partial total"}</span><strong>{mwk(areaRequirementPerUnit(r.tvcPerHa, areaUnit))} / {areaUnitLabel}</strong></div>
            <span>{scenarioCostStatus}</span>
          </div>
          {r.categories.map((category) => {
            const hasCounted = category.countedItems > 0;
            const width = category.costPerHa > 0 ? (category.costPerHa / max) * 100 : 0;
            return <div className="results-category-row" key={category.id}>
              <div className="results-category-label">
                <strong>{category.name}</strong>
                <span>{hasCounted ? mwk(areaRequirementPerUnit(category.costPerHa, areaUnit)) : "—"} <small>{hasCounted ? `· ${pct(category.pctOfTotal)}` : category.problemItems > 0 ? "Incomplete items excluded" : "No counted items"}</small></span>
              </div>
              <div className="results-category-track" role="img" aria-label={`${category.name}: ${hasCounted ? `${pct(category.pctOfTotal)} of included costs` : category.problemItems > 0 ? "incomplete items excluded" : "no counted items"}`}>
                <i style={{ width: `${width}%` }} />
              </div>
            </div>;
          })}
          {hasIncompleteCosts && <p className="results-comparison-note">Incomplete cost items are excluded from the displayed totals. Review the budget status above before relying on these figures.</p>}
          <div className="table-scroll results-cost-table-wrap" role="region" aria-label="Variable costs by category" tabIndex={0}>
            <table className="results-cost-table">
              <thead><tr><th scope="col">Category</th><th scope="col">% of total</th><th scope="col">Per {areaUnitLabel}</th><th scope="col">Whole farm</th></tr></thead>
              <tbody>{r.categories.map((category) => <tr key={category.id}>
                <th scope="row">{category.name}</th>
                <td>{category.countedItems > 0 ? pct(category.pctOfTotal) : "—"}</td>
                <td>{category.countedItems > 0 ? mwk(areaRequirementPerUnit(category.costPerHa, areaUnit)) : "—"}</td>
                <td>{category.countedItems > 0 ? mwk(category.costFarm) : "—"}</td>
              </tr>)}
              <tr><th scope="row"><b>Total variable costs</b></th><td><b>{pct(100)}</b></td><td><b>{mwk(areaRequirementPerUnit(r.tvcPerHa, areaUnit))}</b></td><td><b>{mwk(r.tvcFarm)}</b></td></tr></tbody>
            </table>
          </div>
        </> : <p className="results-empty-note">No complete cost items are available for this breakdown yet. Enter and complete production costs to see the category distribution.</p>}
      </section>
    </div>

    <div className="results-actions">
      <button className="btn sec" onClick={() => go("costs")}>Adjust production costs</button>
      <button className="btn" onClick={() => go("reports")}>Open printable report</button>
    </div>
  </div>;
}
