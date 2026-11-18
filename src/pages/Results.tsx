import { GM_NOTE, Kpi } from "../components/common";
import { useStore } from "../state/store";
import { fmt, mwk, pct } from "../lib/format";
import type { PageId } from "../App";
import type { ScenarioResult } from "../types/index.ts";

export function Missing({ go }: { go: (p: PageId) => void }) {
  const { result: r } = useStore();
  const todo = r.issues.filter((i) => i.severity !== "info");
  return <section className="results-missing" aria-labelledby="results-missing-heading">
    <p className="results-eyebrow">INCOMPLETE BUDGET</p>
    <h2 id="results-missing-heading">Complete the required inputs before reviewing results</h2>
    {todo.length > 0
      ? <ul>{todo.map((i, k) => <li key={`${i.field}-${k}`}>{i.message}</li>)}</ul>
      : <p>No main scenario is available yet. Enter the required farm assumptions to calculate it.</p>}
    {r.alt === null && <p className="results-empty-note">Alternative scenario unavailable. It is optional and will appear when a valid alternative yield is entered.</p>}
    <button className="btn" onClick={() => go("farm")}>Go to Farm Setup</button>
  </section>;
}

export default function Results({ go }: { go: (p: PageId) => void }) {
  const { inputs, result: r } = useStore(); const m = r.main; const a = r.alt;
  if (!m && !a) return <div className="results-page">
    <header className="results-intro"><div><p className="results-eyebrow">FINANCIAL SUMMARY</p><h1>Results</h1>
      <p>Review the main maize budget, key assumptions and variable-cost breakdown using the values already entered.</p></div></header>
    <Missing go={go} />
  </div>;
  const neg = !!m && m.grossMarginPerHa < 0;
  const rows: [string, (s: ScenarioResult) => string][] = [
    ["Expected production (kg/ha)", (s) => fmt(s.productionKgHa, 0)], ["Whole-farm production (t)", (s) => fmt(s.productionTonnesFarm, 2)],
    ["Gross income / ha", (s) => mwk(s.grossIncomePerHa)], ["Gross income, whole farm", (s) => mwk(s.grossIncomeFarm)],
    ["Total variable costs / ha", (s) => mwk(s.tvcPerHa)], ["Total variable costs, whole farm", (s) => mwk(s.tvcFarm)],
    ["Gross margin / ha", (s) => mwk(s.grossMarginPerHa)], ["Gross margin, whole farm", (s) => mwk(s.grossMarginFarm)],
    ["Break-even price (MWK/kg)", (s) => fmt(s.breakEvenPerKg, 2)], ["Return per MWK of variable costs", (s) => fmt(s.returnPerMwk, 2)],
  ];
  const colM = (f: (s: ScenarioResult) => string) => (m ? f(m) : "–");
  const colA = (f: (s: ScenarioResult) => string) => (a ? f(a) : "–");
  const max = Math.max(...r.categories.map((c) => c.costPerHa), 1);
  const statusLabel = r.status === "ready" ? "Budget ready for review" : r.status === "in_progress" ? "Provisional results" : "Incomplete results";
  const statusClass = r.status === "ready" ? "c-ok" : r.status === "in_progress" ? "c-warn" : "c-n";
  return <div className="results-page">
    <header className="results-intro">
      <div>
        <p className="results-eyebrow">FINANCIAL SUMMARY</p>
        <h1>Results</h1>
        <p>Review the main maize budget, key assumptions and variable-cost breakdown using the values already entered.</p>
      </div>
      <span className={`chip results-status ${statusClass}`}>{statusLabel}</span>
    </header>
    {r.status !== "ready" && <div className="results-provisional" role="status">
      <strong>These figures are provisional.</strong>
      <span> Complete the following before review:</span>
      <ul>{r.issues.filter((issue) => issue.severity !== "info").map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul>
    </div>}
    {m ? <>
    <section className={`results-main-financial ${neg ? "is-negative" : ""}`} aria-labelledby="main-gross-margin-heading">
      <div className="results-gross-margin">
        <p id="main-gross-margin-heading">Gross margin · {m.grossMarginPerHa > 0 ? "positive" : neg ? "negative" : "break-even"}</p>
        <strong>{mwk(m.grossMarginPerHa)} <span>per hectare</span></strong>
        <small>{m.grossMarginFarm !== null ? `${mwk(m.grossMarginFarm)} whole farm` : "Whole-farm gross margin unavailable until farm area is entered"}</small>
        <div className="results-gm-note">{GM_NOTE}</div>
      </div>
      <div className="results-financial-grid">
        <Kpi label="Expected revenue" value={mwk(m.grossIncomePerHa)} sub={m.grossIncomeFarm !== null ? `${mwk(m.grossIncomeFarm)} whole farm` : "Whole-farm revenue unavailable"} />
        <Kpi label="Total variable costs" value={mwk(m.tvcPerHa)} sub={m.tvcFarm !== null ? `${mwk(m.tvcFarm)} whole farm` : "Whole-farm variable costs unavailable"} />
        <Kpi label="Break-even selling price" value={`MWK ${fmt(m.breakEvenPerKg, 2)} /kg`} sub={`MWK ${fmt(m.breakEvenPerTonne, 0)}/tonne · MWK ${fmt(m.breakEvenPerBag50, 0)}/50 kg bag`} />
        <Kpi label="Return per MWK of variable costs" value={fmt(m.returnPerMwk, 2)} sub="Gross income ÷ total variable costs" />
      </div>
    </section>
    </> : <div className="results-missing-main">Main scenario figures need a main expected yield and a selling price. The alternative scenario is shown below; enter the main yield in Farm Setup to complete the comparison.</div>}

    <section className="results-assumptions" aria-labelledby="results-assumptions-heading">
      <div className="results-section-heading">
        <div><p className="results-eyebrow">INPUT ASSUMPTIONS</p><h2 id="results-assumptions-heading">Main scenario assumptions</h2></div>
      </div>
      <div className="results-assumption-grid">
        <div><span>Farm area</span><strong>{r.areaHa !== null ? `${fmt(r.areaHa)} ha` : "Not entered"}</strong><small>{r.areaAcres !== null ? `${fmt(r.areaAcres)} acres` : "Acres unavailable"}</small></div>
        <div><span>Main expected yield</span><strong>{m ? `${fmt(m.yieldKgHa, 0)} kg/ha` : "Not entered"}</strong><small>{inputs.yieldMainUnit ?? "Yield unit not selected"}</small></div>
        <div><span>Selling price</span><strong>{r.pricePerKg > 0 ? `MWK ${fmt(r.pricePerKg, 2)} /kg` : "Not entered"}</strong><small>{inputs.priceUnit ?? "Price unit not selected"}</small></div>
        <div><span>Expected production</span><strong>{m ? `${fmt(m.productionKgHa, 0)} kg/ha` : "Not entered"}</strong><small>{m && m.productionKgFarm !== null ? `${fmt(m.productionKgFarm, 0)} kg whole farm` : "Whole-farm production unavailable"}</small></div>
      </div>
    </section>

    <section className="results-comparison" aria-labelledby="results-comparison-heading">
      <div className="results-section-heading">
        <div><p className="results-eyebrow">SCENARIO COMPARISON</p><h2 id="results-comparison-heading">Main vs alternative yield</h2></div>
      </div>
      {!a ? <p className="results-empty-note">Alternative scenario unavailable. It is optional; enter an alternative yield to see the comparison.</p> : <>
        <div className="table-scroll" role="region" aria-label="Main and alternative scenario comparison" tabIndex={0}>
          <table className="results-comparison-table"><thead><tr><th scope="col">Financial measure</th><th scope="col">Main{m ? ` (${fmt(m.yieldKgHa, 0)} kg/ha)` : " (not entered)"}</th><th scope="col">Alternative ({fmt(a.yieldKgHa, 0)} kg/ha)</th></tr></thead>
            <tbody>{rows.map(([l, f]) => <tr key={l}><th scope="row">{l}</th><td>{colM(f)}</td><td>{colA(f)}</td></tr>)}</tbody></table>
        </div>
        <p className="results-comparison-note">Same prices and costs in both scenarios; transport adjusts when yield changes because it is charged per kilogram moved.</p>
        <p className="results-gm-note">{GM_NOTE}</p></>}
    </section>
    <section className="results-costs" aria-labelledby="results-costs-heading">
      <div className="results-section-heading">
        <div><p className="results-eyebrow">VARIABLE COSTS</p><h2 id="results-costs-heading">Costs by category</h2></div>
      </div>
      {r.tvcPerHa <= 0 ? <p className="results-empty-note">No complete cost items yet.</p> : <>
        {r.categories.map((c) => <div className="brow" key={c.id}><span>{c.name}</span><div className="bar" role="img" aria-label={`${c.name} ${pct(c.pctOfTotal)}`}><i style={{ width: `${(c.costPerHa / max) * 100}%` }} /></div>
          <span style={{ textAlign: "right" }}>{pct(c.pctOfTotal)} · {mwk(c.costPerHa)}/ha</span></div>)}
        <div className="table-scroll" role="region" aria-label="Variable costs by category" tabIndex={0} style={{ marginTop: 16 }}>
          <table className="results-cost-table"><thead><tr><th scope="col">Category</th><th scope="col">% of total</th><th scope="col">Per hectare</th><th scope="col">Whole farm</th></tr></thead>
            <tbody>{r.categories.map((c) => <tr key={c.id}><th scope="row">{c.name}</th><td>{pct(c.pctOfTotal)}</td><td>{mwk(c.costPerHa)}</td><td>{mwk(c.costFarm)}</td></tr>)}
              <tr><th scope="row"><b>Total variable costs</b></th><td><b>{pct(100)}</b></td><td><b>{mwk(r.tvcPerHa)}</b></td><td><b>{mwk(r.tvcFarm)}</b></td></tr></tbody></table>
        </div></>}
    </section>
  </div>;
}
