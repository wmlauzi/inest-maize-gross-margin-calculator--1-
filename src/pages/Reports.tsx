import logo from "../assets/inest-logo.png";
import { GM_NOTE } from "../components/common";
import { STATUS_MESSAGE } from "../calculations/validation.ts";
import { useStore } from "../state/store";
import { fmt, mwk } from "../lib/format";
import { areaRequirementPerUnit } from "../calculations/conversions.ts";
import type { PageId } from "../App";
import type { ScenarioResult } from "../types/index.ts";
import { buildReportModel, type ReportCostItem } from "./reportModel.ts";

const farmMoney = (value: number | null) =>
  value === null ? "Not available until a valid farm area is entered." : mwk(value);
const money = (value: number | null) => value === null ? "Not available until a valid farm area is entered." : mwk(value);

function transportCostText(value: number | null, farmValue: number | null, areaUnit: "ha" | "acres") {
  if (value === null) return "Not available while transport selection or pricing is unresolved; scenario totals exclude any transport cost.";
  const areaLabel = areaUnit === "acres" ? "acre" : "ha";
  return `${mwk(areaRequirementPerUnit(value, areaUnit))} per ${areaLabel}; ${farmValue === null ? "whole-farm cost unavailable until farm area is valid" : `${mwk(farmValue)} whole farm`}`;
}

function standardQuantity(row: ReportCostItem, areaUnit: "ha" | "acres") {
  const { item, result } = row;
  if (item.yieldLinked && result.ratePerHaStd <= 0) return "Not available until a valid main yield is entered.";
  if (!item.yieldLinked && (item.rate === null || item.rate <= 0)) return "Not available until a positive rate is entered.";
  if (!result.stdUnit) return "Not available until a valid rate unit is selected.";
  const farmQuantity = result.farmQtyStd === null
    ? "whole-farm quantity unavailable until farm area is valid"
    : `${fmt(result.farmQtyStd, 2)} ${result.stdUnit} whole farm`;
  const areaLabel = areaUnit === "acres" ? "acre" : "ha";
  return `${fmt(areaRequirementPerUnit(result.ratePerHaStd, areaUnit), 2)} ${result.stdUnit}/${areaLabel}; ${farmQuantity}`;
}

function itemRate(row: ReportCostItem, areaUnit: "ha" | "acres") {
  if (row.item.yieldLinked) {
    return row.result.ratePerHaStd <= 0 ? "Not available" : `${fmt(areaRequirementPerUnit(row.result.ratePerHaStd, areaUnit), 2)} kg`;
  }
  return row.item.rate === null ? "Not entered" : fmt(areaRequirementPerUnit(row.item.rate, areaUnit), 2);
}

function itemIssue(row: ReportCostItem, areaUnit: "ha" | "acres") {
  if (row.item.yieldLinked && row.result.ratePerHaStd <= 0) return "A valid main expected yield is required.";
  const message = STATUS_MESSAGE[row.result.status];
  return `${areaUnit === "acres" ? message.replace("per hectare", "per acre") : message}.`;
}

function scenarioRows(
  scenario: ScenarioResult,
  transportCost: number | null,
  transportFarm: number | null,
  areaUnit: "ha" | "acres",
): [string, string][] {
  const areaLabel = areaUnit === "acres" ? "acre" : "ha";
  return [
    ["Expected yield", `${fmt(areaRequirementPerUnit(scenario.yieldKgHa, areaUnit), 0)} kg/${areaLabel}`],
    ["Expected whole-farm production", scenario.productionKgFarm === null
      ? "Not available until a valid farm area is entered."
      : `${fmt(scenario.productionKgFarm, 0)} kg · ${fmt(scenario.productionTonnesFarm, 2)} t · ${fmt(scenario.productionBags50Farm, 0)} × 50 kg bags`],
    [`Expected revenue per ${areaLabel}`, mwk(areaRequirementPerUnit(scenario.grossIncomePerHa, areaUnit))],
    ["Expected revenue, whole farm", farmMoney(scenario.grossIncomeFarm)],
    [`Transport cost per ${areaLabel} / whole farm`, transportCostText(transportCost, transportFarm, areaUnit)],
    [`Total variable costs per ${areaLabel}`, mwk(areaRequirementPerUnit(scenario.tvcPerHa, areaUnit))],
    ["Total variable costs, whole farm", farmMoney(scenario.tvcFarm)],
    [`Gross margin per ${areaLabel}`, mwk(areaRequirementPerUnit(scenario.grossMarginPerHa, areaUnit))],
    ["Gross margin, whole farm", farmMoney(scenario.grossMarginFarm)],
  ];
}

function SummaryTable({ rows, label }: { rows: [string, string][]; label: string }) {
  return <div className="table-scroll report-table-scroll" role="region" aria-label={label} tabIndex={0}>
    <table className="report-summary-table"><tbody>
      {rows.map(([name, value]) => <tr key={name}><th scope="row">{name}</th><td>{value}</td></tr>)}
    </tbody></table>
  </div>;
}

function ReportStatus({ ready }: { ready: boolean }) {
  return <span className={`report-status ${ready ? "is-ready" : "is-draft"}`}>
    {ready ? "Complete report" : "Draft report"}
  </span>;
}

export default function Reports({ go }: { go: (p: PageId) => void }) {
  const { inputs, items, result } = useStore();
  const areaUnit = inputs.areaUnit ?? "ha";
  const areaRequirementLabel = areaUnit === "acres" ? "acre" : "ha";
  const report = buildReportModel(inputs, result, items);
  const main = report.main;
  const alternative = report.alternative;
  const transportItem = report.transport.item;

  const transportAssumption = report.transport.state === "farm_gate"
    ? "Farm-gate sale selected — no transport cost is included."
    : report.transport.state === "included"
      ? "Transport required — valid transport pricing is entered and included."
      : report.transport.state === "unresolved"
        ? `Transport required — cost is not included. ${transportItem ? STATUS_MESSAGE[transportItem.result.status] : "Transport pricing is incomplete"}.`
        : "Transport arrangement not selected — transport cost remains unresolved.";

  const transportMainCost = report.transport.state === "farm_gate"
    ? "Excluded — farm-gate sale."
    : report.transport.state === "included" && transportItem
      ? transportCostText(transportItem.result.costPerHa, transportItem.result.costFarm, areaUnit)
      : "Not included — transport selection or pricing is unresolved.";

  const areaText = inputs.area === null ? "Not entered"
    : inputs.areaUnit === null ? `${fmt(inputs.area, 2)} (unit not selected)`
      : `${fmt(inputs.area, 2)} ${inputs.areaUnit} (equivalent ${fmt(inputs.areaUnit === "ha" ? result.areaAcres : result.areaHa, 2)} ${inputs.areaUnit === "ha" ? "acres" : "ha"})`;
  const mainYieldText = inputs.yieldMain === null ? "Not entered"
    : `${fmt(inputs.yieldMain, 2)} ${inputs.yieldMainUnit ?? "(unit not selected)"}` +
      (result.yieldMainKgHa > 0 ? ` (${fmt(areaRequirementPerUnit(result.yieldMainKgHa, areaUnit), 0)} kg/${areaRequirementLabel})` : "");
  const sellingPriceText = inputs.price === null ? "Not entered"
    : `${mwk(inputs.price, 2)} ${inputs.priceUnit?.replace("MWK per ", "per ") ?? "(unit not selected)"}` +
      (result.pricePerKg > 0 ? ` (${mwk(result.pricePerKg, 2)}/kg)` : "");
  const alternativeYieldText = inputs.yieldAlt === null ? "Not provided"
    : `${fmt(inputs.yieldAlt, 2)} ${inputs.yieldAltUnit ?? "(unit not selected)"}` +
      (result.yieldAltKgHa > 0 ? ` (${fmt(areaRequirementPerUnit(result.yieldAltKgHa, areaUnit), 0)} kg/${areaRequirementLabel})` : "");

  const mainRows: [string, string][] = [
    ["Enterprise", inputs.description || "Not entered"],
    ["Season", inputs.season || "Not entered"],
    ["Farm area (selected unit)", areaText],
    [`Main expected yield per ${areaRequirementLabel}`, mainYieldText],
    [`Alternative expected yield per ${areaRequirementLabel}`, alternativeYieldText],
    ["Selling price (selected unit)", sellingPriceText],
    ["Transport arrangement", transportAssumption],
    ["Main-scenario transport cost", transportMainCost],
    ["Expected whole-farm production", main?.productionKgFarm === null || !main
      ? "Not available — a valid main scenario and farm area are required."
      : `${fmt(main.productionKgFarm, 0)} kg · ${fmt(main.productionTonnesFarm, 2)} t · ${fmt(main.productionBags50Farm, 0)} × 50 kg bags`],
    [`Expected revenue per ${areaRequirementLabel}`, main ? mwk(areaRequirementPerUnit(main.grossIncomePerHa, areaUnit)) : "Not available — main scenario inputs are incomplete."],
    ["Expected revenue, whole farm", main ? farmMoney(main.grossIncomeFarm) : "Not available — main scenario inputs are incomplete."],
    [`Total variable costs per ${areaRequirementLabel}`, mwk(areaRequirementPerUnit(result.tvcPerHa, areaUnit))],
    ["Total variable costs, whole farm", farmMoney(result.tvcFarm)],
    [`Gross margin per ${areaRequirementLabel}`, main ? mwk(areaRequirementPerUnit(main.grossMarginPerHa, areaUnit)) : "Not available — main scenario inputs are incomplete."],
    ["Gross margin, whole farm", main ? farmMoney(main.grossMarginFarm) : "Not available — main scenario inputs are incomplete."],
    ["Break-even selling price", main?.breakEvenPerKg === null || !main
      ? "Not calculable without valid production."
      : `${mwk(main.breakEvenPerKg, 2)}/kg · ${mwk(main.breakEvenPerTonne, 0)}/tonne · ${mwk(main.breakEvenPerBag50, 0)}/50 kg bag`],
    ["Return per MWK of variable costs", !main
      ? "Not available — main scenario inputs are incomplete."
      : main.returnPerMwk === null ? "Not calculable when variable costs are zero." : fmt(main.returnPerMwk, 2)],
  ];

  return <>
    <div className="noprint report-toolbar">
      <div><h1>Reports</h1><p className="lead">Review, print, or save this budget as a PDF.</p></div>
      <button className="btn full-m" onClick={() => window.print()}>Print / Save as PDF</button>
    </div>
    <article className="report report-document">
      <header className="report-brand">
        <img src={logo} alt="iNest Agro" />
        <div><strong>iNest Agro</strong><p>Smarter Farming. Better Decisions.</p></div>
        <ReportStatus ready={report.ready} />
      </header>
      <div className="report-heading">
        <p>MAIZE PRODUCTION BUDGET</p>
        <h2 className="report-title">Maize Gross Margin Budget</h2>
        <div className="report-heading-meta">
          <span>{inputs.description || "Enterprise not entered"}</span>
          <span>{inputs.season || "Season not entered"}</span>
        </div>
      </div>
      {!report.ready && <section className="report-draft" aria-label="Incomplete budget notice">
        <h2>DRAFT — Incomplete budget</h2>
        <p>This is not a completed financial report. Resolve the following before relying on these figures:</p>
        {report.issues.length > 0
          ? <ul>{report.issues.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul>
          : <p>Complete the required farm, transport, and cost details before treating this report as final.</p>}
        {!main && alternative && <p><b>Main scenario unavailable.</b> Only the alternative-yield scenario is shown; no main-scenario figures have been estimated.</p>}
        <button className="btn sec noprint" onClick={() => go("farm")}>Review Farm Setup</button>
      </section>}

      <section className="report-section">
        <div className="report-section-heading"><p>01</p><h2>Farm and production summary</h2></div>
        <SummaryTable rows={mainRows} label="Farm and main production summary" />
      </section>

      <section className="report-section">
        <div className="report-section-heading"><p>02</p><h2>Financial summary</h2></div>
        <div className="report-financial-summary">
          <div className="report-gross-margin">
            <span>Gross margin per {areaRequirementLabel}</span>
            <strong>{main ? mwk(areaRequirementPerUnit(main.grossMarginPerHa, areaUnit)) : "Not available"}</strong>
            <small>{main ? farmMoney(main.grossMarginFarm) : "Whole-farm gross margin unavailable"}{main?.grossMarginFarm !== null && main ? " whole farm" : ""}</small>
          </div>
          <div className="report-financial-grid">
            <div><span>Expected revenue / {areaRequirementLabel}</span><strong>{main ? mwk(areaRequirementPerUnit(main.grossIncomePerHa, areaUnit)) : "Not available"}</strong></div>
            <div><span>Total variable costs / {areaRequirementLabel}</span><strong>{mwk(areaRequirementPerUnit(result.tvcPerHa, areaUnit))}</strong></div>
            <div><span>Break-even price</span><strong>{main ? `${mwk(main.breakEvenPerKg, 2)}/kg` : "Not available"}</strong></div>
            <div><span>Return per MWK of variable costs</span><strong>{main?.returnPerMwk == null ? "n/a" : fmt(main.returnPerMwk, 2)}</strong></div>
          </div>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-heading"><p>03</p><h2>Detailed production costs</h2></div>
        <p className="report-explainer">Only started cost items are listed. Incomplete items are not included in the calculated cost totals.</p>
        {report.categories.map((category, index) => <section className="report-category" key={category.id}>
          <h3><span>{String(index + 1).padStart(2, "0")}</span>{category.name}</h3>
          <p className="report-category-total">Category total: {mwk(areaRequirementPerUnit(category.costPerHa, areaUnit))} per {areaRequirementLabel} · {category.costFarm === null ? "whole-farm total not available until farm area is valid" : `${mwk(category.costFarm)} whole farm`}</p>
          {category.items.length === 0
            ? <p className="report-empty-cost">{category.id === "transport" && report.transport.state === "farm_gate"
              ? "No transport costs included (farm-gate sale)."
              : "No cost items entered."}</p>
            : <div className="table-scroll" role="region" aria-label={`${category.name} cost items`} tabIndex={0}>
              <table className="report-cost-table">
                <thead><tr>
                  <th scope="col">Item</th><th scope="col">Rate / {areaRequirementLabel}</th><th scope="col">Rate unit</th>
                  <th scope="col">Converted quantity / {areaRequirementLabel}</th><th scope="col">Price</th><th scope="col">Price unit</th>
                  <th scope="col">Cost / {areaRequirementLabel}</th><th scope="col">Whole-farm cost</th><th scope="col">Notes</th>
                </tr></thead>
                <tbody>{category.items.map((row) => <tr key={row.item.id}>
                  <th scope="row">{row.item.name.trim() || "Name not entered"}
                    {!row.result.counted && <small className="report-item-status">Not included — {itemIssue(row, areaUnit)}</small>}
                  </th>
                  <td>{itemRate(row, areaUnit)}</td>
                  <td>{row.item.yieldLinked ? "kg (linked to main yield)" : row.item.rateUnit ?? "Not selected"}</td>
                  <td>{standardQuantity(row, areaUnit)}</td>
                  <td>{row.item.price === null ? "Not entered" : mwk(row.item.price)}</td>
                  <td>{row.item.priceUnit ?? "Not selected"}</td>
                  <td>{row.result.counted ? mwk(areaRequirementPerUnit(row.result.costPerHa, areaUnit)) : "Not included"}</td>
                  <td>{row.result.counted ? money(row.result.costFarm) : "Not included"}</td>
                  <td>{row.item.notes.trim() || "—"}</td>
                </tr>)}</tbody>
              </table>
            </div>}
        </section>)}
        <div className="report-totals">
          <b>Total variable costs</b><span>{mwk(areaRequirementPerUnit(result.tvcPerHa, areaUnit))} per {areaRequirementLabel}</span>
          <span>{result.tvcFarm === null ? "Whole-farm total not available until farm area is valid." : `${mwk(result.tvcFarm)} whole farm`}</span>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-heading"><p>04</p><h2>Alternative yield scenario</h2></div>
        {!alternative
          ? <p>{inputs.yieldAlt === null
            ? "Alternative scenario not provided. No alternative figures are included."
            : "Alternative scenario unavailable: enter a valid alternative yield and selling price. No alternative figures are included."}</p>
          : <SummaryTable rows={scenarioRows(
            alternative,
            report.transport.state === "farm_gate" ? null : report.transport.alternativeCostPerHa,
            report.transport.state === "farm_gate" ? null : report.transport.alternativeCostFarm,
            areaUnit,
          ).map(([name, value]) => name === `Transport cost per ${areaRequirementLabel} / whole farm` && report.transport.state === "farm_gate"
            ? [name, "Excluded — farm-gate sale."]
            : [name, value])} label="Alternative yield scenario summary" />}
      </section>

      <section className="report-section">
        <div className="report-section-heading"><p>05</p><h2>Assumptions and limitations</h2></div>
        <p><b>{GM_NOTE}</b></p>
        <ul className="muted">
          <li>All expected production is assumed sold at the single selling price entered.</li>
          <li>All prices and rates are the user’s own entries; none are recommendations.</li>
          <li>Alternative scenario uses the same prices and non-transport costs; yield-linked transport is adjusted by yield.</li>
          <li>Expected yields are planning assumptions, not forecasts.</li>
        </ul>
      </section>
      <section className="report-section report-signoff" aria-label="Sign-off and approval">
        <div className="report-section-heading"><p>06</p><h2>Sign-off and Approval</h2></div>
        <div className="report-signoff-grid">
          <div className="report-signoff-area">
            <h3>Prepared by</h3>
            <p>Person entering information</p>
            <div className="report-signoff-fields">
              <div><span>Full name</span><b aria-label="Blank line for full name"></b></div>
              <div><span>Signature</span><b className="report-signature-line" aria-label="Blank line for handwritten signature"></b></div>
              <div><span>Date</span><b aria-label="Blank line for date"></b></div>
            </div>
          </div>
          <div className="report-signoff-area">
            <h3>Reviewed and approved by</h3>
            <p>Supervisor</p>
            <div className="report-signoff-fields">
              <div><span>Full name</span><b aria-label="Blank line for full name"></b></div>
              <div><span>Signature</span><b className="report-signature-line" aria-label="Blank line for handwritten signature"></b></div>
              <div><span>Date</span><b aria-label="Blank line for date"></b></div>
            </div>
          </div>
        </div>
      </section>
      <footer className="report-footer">
        Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · iNest Agro — Smarter Farming. Better Decisions.
      </footer>
    </article>
  </>;
}
