import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { GM_NOTE, StatusBadge } from "../components/common";
import { useStore } from "../state/store";
import { fmt, mwk } from "../lib/format";
import type { PageId } from "../App";

type WorkflowState = "complete" | "in_progress" | "pending";

const workflowLabel: Record<WorkflowState, string> = {
  complete: "Complete",
  in_progress: "In progress",
  pending: "Pending",
};

function WorkflowStep({
  number, title, detail, state,
}: { number: number; title: string; detail: string; state: WorkflowState }) {
  return <li className={`dashboard-step is-${state}`}>
    <span className="dashboard-step-marker" aria-hidden="true">{state === "complete" ? "✓" : number}</span>
    <div className="dashboard-step-copy">
      <div className="dashboard-step-title">
        <strong>{title}</strong>
        <span className={`dashboard-step-status is-${state}`}>{workflowLabel[state]}</span>
      </div>
      <p>{detail}</p>
    </div>
  </li>;
}

function FinancialMetric({
  label, value, detail, featured = false,
}: { label: string; value: string; detail: string; featured?: boolean }) {
  return <div className={`dashboard-metric ${featured ? "is-featured" : ""}`}>
    <span className="dashboard-metric-label">{label}</span>
    <strong>{value}</strong>
    <small>{detail}</small>
  </div>;
}

export default function Dashboard({ go }: { go: (p: PageId) => void }) {
  const { inputs, items, result: r, dispatch } = useStore();
  const [confirm, setConfirm] = useState(false);
  const startNewButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const setupIssues = r.issues.filter((issue) => !issue.field.startsWith("item:") && issue.severity !== "info");
  const costIssues = r.issues.filter((issue) => issue.field.startsWith("item:") && issue.severity !== "info");
  const setupComplete = setupIssues.length === 0;
  const setupStarted = inputs.area !== null || inputs.yieldMain !== null || inputs.price !== null ||
    inputs.description.trim() !== "" || inputs.season.trim() !== "";
  const costsComplete = inputs.transportArrangement !== null && costIssues.length === 0;
  const costsStarted = inputs.transportArrangement !== null || items.some((item) => !item.yieldLinked &&
    (item.rate !== null || item.price !== null || item.rateUnit !== null || item.priceUnit !== null ||
      item.name.trim() !== "" || item.description.trim() !== "" || item.notes.trim() !== ""));
  const resultsComplete = r.status === "ready";
  const workflow: { title: string; detail: string; state: WorkflowState }[] = [
    {
      title: "Farm Setup",
      detail: "Farm area, expected yield and selling price",
      state: setupComplete ? "complete" : setupStarted ? "in_progress" : "pending",
    },
    {
      title: "Production Costs",
      detail: "Configure variable costs and transport arrangement",
      state: costsComplete ? "complete" : costsStarted ? "in_progress" : "pending",
    },
    {
      title: "Results",
      detail: resultsComplete ? "Budget is ready for review" : r.main ? "Provisional results are available" : "Available when the main yield and price are entered",
      state: resultsComplete ? "complete" : r.main ? "in_progress" : "pending",
    },
  ];
  const completedSteps = workflow.filter((step) => step.state === "complete").length;
  const remaining = r.issues.filter((issue) => issue.severity !== "info");
  const started = r.status !== "not_started";
  const countedCostItems = r.categories.reduce((total, category) => total + category.countedItems, 0);
  const problemCostItems = r.categories.reduce((total, category) => total + category.problemItems, 0);
  const hasCostTotals = r.status === "ready" || countedCostItems > 0;
  const partialCostTotals = hasCostTotals && problemCostItems > 0;
  const breakEvenPrice = r.main?.breakEvenPerBag50;
  const breakEvenAvailable = breakEvenPrice !== null && breakEvenPrice !== undefined &&
    (breakEvenPrice > 0 || r.status === "ready");

  useEffect(() => {
    if (confirm) cancelButton.current?.focus();
  }, [confirm]);
  const closeConfirmation = () => {
    setConfirm(false);
    startNewButton.current?.focus();
  };
  const closeConfirmationOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") closeConfirmation();
  };

  const overviewItems = [
    inputs.description.trim() ? { label: "Farm or enterprise", value: inputs.description.trim() } : null,
    inputs.season.trim() ? { label: "Season", value: inputs.season.trim() } : null,
    inputs.area !== null ? {
      label: "Farm area",
      value: `${fmt(inputs.area)} ${inputs.areaUnit === "ha" ? "ha" : inputs.areaUnit ?? ""}`.trim(),
    } : null,
    inputs.yieldMain !== null ? {
      label: "Main expected yield",
      value: `${fmt(inputs.yieldMain)} ${inputs.yieldMainUnit ?? ""}`.trim(),
    } : null,
    inputs.price !== null ? {
      label: "Selling price",
      value: `${mwk(inputs.price, 2)}${inputs.priceUnit ? ` / ${inputs.priceUnit.replace("MWK per ", "")}` : ""}`,
    } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);
  const categoryUnit = r.areaHa !== null ? "whole farm" : "per hectare";

  return <div className="dashboard">
    <section className="dashboard-section dashboard-calculation" aria-labelledby="dashboard-calculation-heading">
      <div className="dashboard-calculation-heading">
        <div>
          <p className="dashboard-eyebrow">CALCULATION OVERVIEW</p>
          <h1 id="dashboard-calculation-heading">Maize gross margin budget</h1>
        </div>
        <StatusBadge s={r.status} />
      </div>
      {overviewItems.length > 0
        ? <dl className="dashboard-overview">
          {overviewItems.map((item) => <div className="dashboard-overview-item" key={item.label}>
            <dt>{item.label}</dt><dd>{item.value}</dd>
          </div>)}
        </dl>
        : <p className="dashboard-overview-empty">Farm and production details will appear here as you complete Farm Setup.</p>}
      <span className="dashboard-currency">Currency: MWK (MK)</span>
    </section>

    <section className="dashboard-intro" aria-labelledby="dashboard-intro-heading">
      <div className="dashboard-intro-copy">
        <p className="dashboard-eyebrow">MAIZE GROSS MARGIN PLANNING</p>
        <h2 id="dashboard-intro-heading">Plan your maize production with confidence.</h2>
        <p>Estimate production costs, expected income and gross margin using your farm’s details and current prices.</p>
      </div>
      <div className="dashboard-actions" aria-label="Budget actions">
        <button className="btn dashboard-action-primary" onClick={() => go("farm")}>Continue to Farm Setup</button>
        {started && <button ref={startNewButton} className="btn sec" onClick={() => setConfirm(true)}>Start a New Calculation</button>}
      </div>
    </section>

    {confirm && <div className="note reset-confirmation dashboard-confirmation" role="group" aria-labelledby="reset-budget-title" onKeyDown={closeConfirmationOnEscape}>
      <p id="reset-budget-title">Start a new budget? Everything you entered on this device will be discarded.</p>
      <div className="dialog-actions">
        <button className="btn del" onClick={() => { dispatch({ t: "reset" }); setConfirm(false); go("farm"); }}>Discard and start new</button>
        <button ref={cancelButton} className="btn sec" onClick={closeConfirmation}>Cancel</button>
      </div>
    </div>}

    <section className="dashboard-section" aria-labelledby="dashboard-progress-heading">
      <div className="dashboard-section-heading dashboard-progress-heading">
        <div>
          <p className="dashboard-eyebrow">BUDGET WORKFLOW</p>
          <h2 id="dashboard-progress-heading">Workflow status</h2>
        </div>
        <span className="dashboard-progress-count">{completedSteps} of 3 complete</span>
      </div>
      <ol className="dashboard-steps">
        {workflow.map((step, index) => <WorkflowStep key={step.title} number={index + 1} {...step} />)}
      </ol>
      <div className={`dashboard-checklist ${remaining.length === 0 ? "is-complete" : ""}`} aria-live="polite">
        {remaining.length === 0
          ? <p>All required inputs and started cost items are complete.</p>
          : <><p>{r.status === "not_started" ? "Start Farm Setup to begin your budget." : "What remains to complete this budget:"}</p>
            {r.status !== "not_started" && <ul>{remaining.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul>}</>}
      </div>
    </section>

    <section className="dashboard-section" aria-labelledby="dashboard-financial-heading">
      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-eyebrow">FINANCIAL PERFORMANCE</p>
          <h2 id="dashboard-financial-heading">Financial overview</h2>
        </div>
        <span className={`dashboard-financial-status ${r.main ? "is-available" : ""}`}>
          {r.status === "ready" ? "Budget complete" : r.main ? "Provisional figures" : "Awaiting inputs"}
        </span>
      </div>
      {r.main && r.status !== "ready" && <p className="dashboard-provisional">These figures are provisional. Complete the workflow before relying on them.</p>}
      <div className="dashboard-metrics">
        <FinancialMetric
          label="Gross Margin (Total)"
          value={r.main?.grossMarginFarm !== null && r.main?.grossMarginFarm !== undefined ? mwk(r.main.grossMarginFarm) : "Pending"}
          detail="Whole farm"
          featured
        />
        <FinancialMetric
          label="Gross Margin per hectare"
          value={r.main ? mwk(r.main.grossMarginPerHa) : "Pending"}
          detail="MWK / ha"
        />
        <FinancialMetric
          label="Expected Revenue"
          value={r.main?.grossIncomeFarm !== null && r.main?.grossIncomeFarm !== undefined ? mwk(r.main.grossIncomeFarm) : "Pending"}
          detail="Whole farm"
        />
        <FinancialMetric
          label="Total Variable Costs"
          value={hasCostTotals && r.tvcFarm !== null ? mwk(r.tvcFarm) : "Pending"}
          detail={partialCostTotals ? "Partial total; incomplete items excluded" : "Whole farm"}
        />
        <FinancialMetric
          label="Break-even selling price"
          value={breakEvenAvailable ? mwk(breakEvenPrice, 2) : "Pending"}
          detail="MWK / 50 kg bag"
        />
        <FinancialMetric
          label="Return per MWK of variable costs"
          value={r.main?.returnPerMwk !== null && r.main?.returnPerMwk !== undefined ? fmt(r.main.returnPerMwk, 2) : r.status === "ready" ? "n/a" : "Pending"}
          detail={r.main?.returnPerMwk !== null && r.main?.returnPerMwk !== undefined ? "MWK revenue per MWK of variable costs" : r.status === "ready" ? "Not available when variable costs are zero" : "Available when results can be calculated"}
        />
      </div>
      {!r.main && <p className="dashboard-financial-empty">Enter the main expected yield and selling price in Farm Setup to calculate the main scenario. Values that cannot yet be calculated are shown as pending.</p>}
    </section>

    <section className="dashboard-section" aria-labelledby="dashboard-categories-heading">
      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-eyebrow">INPUT LEDGER</p>
          <h2 id="dashboard-categories-heading">Production categories</h2>
        </div>
        <button className="dashboard-text-action" onClick={() => go("costs")}>Open Production Costs <span aria-hidden="true">→</span></button>
      </div>
      <p className="dashboard-category-unit">Cost totals shown {categoryUnit}; incomplete entries are identified and excluded from calculated totals.</p>
      <ol className="dashboard-category-list">
        {r.categories.map((category, index) => {
          const isTransport = category.id === "transport";
          const farmGate = isTransport && inputs.transportArrangement === "farm_gate";
          const status = farmGate ? "No transport cost included" : isTransport && inputs.transportArrangement === null
            ? "Select transport arrangement" : category.problemItems > 0 ? "Incomplete"
              : category.countedItems > 0 ? "Configured" : "Not configured";
          const hasAmount = category.countedItems > 0 && (r.areaHa !== null ? category.costFarm !== null : true);
          const amount = !hasAmount ? "—" : mwk(r.areaHa !== null ? category.costFarm : category.costPerHa);
          return <li className={`dashboard-category ${category.problemItems > 0 ? "has-problem" : ""}`} key={category.id}>
            <span className="dashboard-category-number" aria-hidden="true">{index + 1}</span>
            <span className="dashboard-category-name">{category.name}</span>
            <span className="dashboard-category-status">{status}</span>
            <strong className="dashboard-category-amount">{amount}</strong>
          </li>;
        })}
      </ol>
    </section>

    <aside className="dashboard-formula" aria-label="Gross margin formula and limitations">
      <span className="dashboard-formula-mark" aria-hidden="true">i</span>
      <div>
        <strong>Calculation formula</strong>
        <p>Gross Margin = Expected Revenue − Total Variable Production Costs.</p>
        <p>{GM_NOTE}</p>
      </div>
    </aside>
  </div>;
}
