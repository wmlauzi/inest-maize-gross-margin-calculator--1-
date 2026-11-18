import { useState } from "react";
import { Field, Num, StatusBadge } from "../components/common";
import { useStore } from "../state/store";
import { AREA_UNITS, PRICE_FACTORS, YIELD_FACTORS } from "../data/units.ts";
import type { PageId } from "../App";
import type { AreaUnit, BudgetInputs, PriceUnit, YieldUnit } from "../types/index.ts";
import { fmt, mwk } from "../lib/format";

export default function FarmSetup({ go }: { go: (p: PageId) => void }) {
  const { inputs: i, result: r, dispatch } = useStore();
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);
  const set = (patch: Partial<BudgetInputs>) => dispatch({ t: "input", patch });
  const touch = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));
  const err = (field: string) => (touched[field] || showRequiredErrors)
    ? r.issues.find((x) => x.field === field && x.severity !== "info")?.message
    : undefined;
  const unitError = (field: string) => err(field)
    ? <div id={`${field}-error`} className="err" role="alert">{err(field)}</div>
    : null;
  const requiredFields = ["area", "areaUnit", "yieldMain", "yieldMainUnit", "price", "priceUnit"];
  const continueToCosts = () => {
    setShowRequiredErrors(true);
    const fieldsToCheck = i.yieldAlt === null ? requiredFields : [...requiredFields, "yieldAlt", "yieldAltUnit"];
    if (fieldsToCheck.some((field) => r.issues.some((issue) => issue.field === field && issue.severity !== "info"))) return;
    go("costs");
  };
  const blockingIssues = r.issues.filter((issue) => issue.severity !== "info");
  const areaUnitLabel = i.areaUnit === "ha" ? "hectares (ha)" : i.areaUnit === "acres" ? "acres" : "not selected";
  const areaValue = i.area === null ? "Not entered" : `${fmt(i.area)} ${i.areaUnit ?? "unit not selected"}`;
  const mainYieldValue = i.yieldMain === null ? "Not entered" : `${fmt(i.yieldMain)} ${i.yieldMainUnit ?? "(unit not selected)"}`;
  const alternativeYieldValue = i.yieldAlt === null ? "Not entered" : `${fmt(i.yieldAlt)} ${i.yieldAltUnit ?? "(unit not selected)"}`;
  const sellingPriceValue = i.price === null
    ? "Not entered"
    : `${mwk(i.price, 2)}${i.priceUnit ? ` / ${i.priceUnit.replace("MWK per ", "")}` : ""}`;
  const areaEquivalent = r.areaHa !== null && r.areaAcres !== null
    ? `${fmt(r.areaHa, 2)} ha · ${fmt(r.areaAcres, 2)} acres`
    : "Pending";
  const productionForYield = (yieldKgHa: number) => {
    if (r.areaHa === null || yieldKgHa <= 0) return "Pending";
    const productionKg = yieldKgHa * r.areaHa;
    return `${fmt(productionKg / 1000, 2)} tonnes · ${fmt(productionKg / 50, 0)} bags (50 kg)`;
  };
  const mainProduction = productionForYield(r.yieldMainKgHa);
  const alternativeProduction = i.yieldAlt === null ? "Not entered" : productionForYield(r.yieldAltKgHa);
  const priceEquivalents = r.pricePerKg > 0
    ? `${mwk(r.pricePerKg, 2)} / kg · ${mwk(r.pricePerKg * PRICE_FACTORS["MWK per 50 kg bag"], 2)} / 50 kg bag · ${mwk(r.pricePerKg * PRICE_FACTORS["MWK per tonne"], 2)} / tonne`
    : i.price === null ? "Not entered" : "Pending";

  return <div className="farm-setup">
    <header className="farm-setup-intro">
      <div>
        <p className="farm-setup-eyebrow">BUDGET SETUP · STEP 1</p>
        <h1>Farm Setup</h1>
        <p>Enter your farm details, production area and expected maize yield to establish the basis for your gross margin calculation.</p>
      </div>
      <div className="farm-setup-progress" aria-label="Budget setup progress">
        <span className="is-current">1 <b>Farm Setup</b></span>
        <i aria-hidden="true" />
        <span>2 <b>Production Costs</b></span>
        <i aria-hidden="true" />
        <span>3 <b>Results</b></span>
      </div>
    </header>

    <div className="farm-setup-layout">
      <div className="farm-setup-form">
        <section className="farm-form-section" aria-labelledby="farm-details-heading">
          <div className="farm-form-heading">
            <span className="farm-section-number" aria-hidden="true">01</span>
            <div>
              <h2 id="farm-details-heading">Farm and calculation details</h2>
              <p>Add optional labels to help identify this farm budget. They do not affect calculations.</p>
            </div>
          </div>
          <div className="farm-form-grid farm-details-grid">
            <Field label="Season (optional)" htmlFor="season">
              <input id="season" value={i.season} onChange={(e) => set({ season: e.target.value })} placeholder="e.g. 2026/27" />
            </Field>
            <Field label="Farm or enterprise description (optional)" htmlFor="desc">
              <input id="desc" value={i.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="farm-form-section" aria-labelledby="farm-area-heading">
          <div className="farm-form-heading">
            <span className="farm-section-number" aria-hidden="true">02</span>
            <div>
              <h2 id="farm-area-heading">Farm area</h2>
              <p>Enter the cropped area; the calculator converts it to hectares for whole-farm calculations.</p>
            </div>
          </div>
          <div className="farm-area-entry">
            <Field label="Farm area (required)" error={err("area")} errorId="area-error" htmlFor="area">
              <div className="row">
                <Num id="area" required value={i.area} aria-invalid={!!err("area")} aria-describedby={err("area") ? "area-error" : undefined}
                  onBlur={() => touch("area")} onChange={(v) => set({ area: v })} />
                <select id="areaUnit" required aria-label="Farm area unit" value={i.areaUnit ?? ""} aria-invalid={!!err("areaUnit")}
                  aria-describedby={err("areaUnit") ? "areaUnit-error" : undefined} onBlur={() => touch("areaUnit")}
                  onChange={(e) => set({ areaUnit: (e.target.value || null) as AreaUnit | null })}>
                  <option value="">Select unit</option>
                  {AREA_UNITS.map((u) => <option key={u} value={u}>{u === "ha" ? "Hectares (ha)" : "Acres"}</option>)}
                </select>
              </div>{unitError("areaUnit")}
            </Field>
            <p className="farm-area-unit-note">Selected area unit: <strong>{areaUnitLabel}</strong></p>
            {r.areaHa !== null
              ? <p className="farm-area-conversion" role="status">Equivalent area: <strong>{fmt(r.areaHa, 4)} ha</strong> · {fmt(r.areaAcres, 2)} acres. Hectares are used internally for calculations.</p>
              : <p className="farm-area-help">Enter a positive farm area and select its unit to see the equivalent area.</p>}
          </div>
        </section>

        <section className="farm-form-section" aria-labelledby="farm-yield-heading">
          <div className="farm-form-heading">
            <span className="farm-section-number" aria-hidden="true">03</span>
            <div>
              <h2 id="farm-yield-heading">Expected maize yield</h2>
              <p>Enter the expected yield rate per hectare. Choose the unit that matches your estimate.</p>
            </div>
          </div>
          <div className="farm-yield-main">
            <h3>Main expected yield <span>Required</span></h3>
            <Field label="Main expected yield (required)" error={err("yieldMain")} errorId="yieldMain-error" htmlFor="ym">
              <div className="row">
                <Num id="ym" required value={i.yieldMain} aria-invalid={!!err("yieldMain")} aria-describedby={err("yieldMain") ? "yieldMain-error" : undefined}
                  onBlur={() => touch("yieldMain")} onChange={(v) => set({ yieldMain: v })} />
                <select required aria-label="Main yield unit" value={i.yieldMainUnit ?? ""} aria-invalid={!!err("yieldMainUnit")}
                  aria-describedby={err("yieldMainUnit") ? "yieldMainUnit-error" : undefined} onBlur={() => touch("yieldMainUnit")}
                  onChange={(e) => set({ yieldMainUnit: (e.target.value || null) as YieldUnit | null })}>
                  <option value="">Select unit</option>{Object.keys(YIELD_FACTORS).map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>{unitError("yieldMainUnit")}
            </Field>
            <div className="farm-output-summary" role="status">
              <span>Expected total output (whole farm)</span>
              <strong>{mainProduction}</strong>
              <small>Available when the main yield and farm area are valid.</small>
            </div>
          </div>
        </section>

        <section className="farm-form-section" aria-labelledby="farm-alternative-heading">
          <div className="farm-form-heading">
            <span className="farm-section-number" aria-hidden="true">04</span>
            <div>
              <h2 id="farm-alternative-heading">Alternative yield scenario</h2>
              <p>This second yield scenario is optional. Leave it blank if you do not need a comparison.</p>
            </div>
          </div>
          <div className="farm-yield-alt">
            <h3>Alternative expected yield <span>Optional</span></h3>
            <Field label="Alternative expected yield (optional)" error={err("yieldAlt")} errorId="yieldAlt-error" htmlFor="ya">
              <div className="row">
                <Num id="ya" value={i.yieldAlt} aria-invalid={!!err("yieldAlt")} aria-describedby={err("yieldAlt") ? "yieldAlt-error" : undefined}
                  onBlur={() => touch("yieldAlt")} onChange={(v) => set({ yieldAlt: v })} />
                <select aria-label="Alternative yield unit" value={i.yieldAltUnit ?? ""} aria-invalid={!!err("yieldAltUnit")}
                  aria-describedby={err("yieldAltUnit") ? "yieldAltUnit-error" : undefined} onBlur={() => touch("yieldAltUnit")}
                  onChange={(e) => set({ yieldAltUnit: (e.target.value || null) as YieldUnit | null })}>
                  <option value="">Select unit</option>{Object.keys(YIELD_FACTORS).map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>{unitError("yieldAltUnit")}
            </Field>
            <div className="farm-output-summary is-alternative" role="status">
              <span>Alternative total output (whole farm)</span>
              <strong>{alternativeProduction}</strong>
              <small>{i.yieldAlt === null ? "No alternative yield entered." : "Available when the alternative yield and farm area are valid."}</small>
            </div>
          </div>
        </section>

        <section className="farm-form-section farm-price-section" aria-labelledby="farm-price-heading">
          <div className="farm-form-heading">
            <span className="farm-section-number" aria-hidden="true">05</span>
            <div>
              <h2 id="farm-price-heading">Selling price</h2>
              <p>Enter the price you expect to receive. This is your estimate, not an official or guaranteed market price.</p>
            </div>
          </div>
          <Field label="Maize selling price (required; all expected production is assumed sold)" error={err("price")} errorId="price-error" htmlFor="price">
            <div className="row">
              <Num id="price" required value={i.price} aria-invalid={!!err("price")} aria-describedby={err("price") ? "price-error" : undefined}
                onBlur={() => touch("price")} onChange={(v) => set({ price: v })} />
              <select required aria-label="Selling price unit" value={i.priceUnit ?? ""} aria-invalid={!!err("priceUnit")}
                aria-describedby={err("priceUnit") ? "priceUnit-error" : undefined} onBlur={() => touch("priceUnit")}
                onChange={(e) => set({ priceUnit: (e.target.value || null) as PriceUnit | null })}>
                <option value="">Select unit</option>{Object.keys(PRICE_FACTORS).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>{unitError("priceUnit")}
          </Field>
          <div className="farm-price-equivalents" role="status">
            <span>Equivalent price rates</span>
            <strong>{priceEquivalents}</strong>
          </div>
          <p className="farm-price-note">The entered price applies to all expected production in the calculation.</p>
        </section>

        <div className="farm-setup-actions">
          <button className="btn full-m" onClick={continueToCosts}>Save and continue to costs</button>
        </div>
      </div>

      <aside className="farm-setup-summary" aria-labelledby="farm-summary-heading">
        <div className="farm-summary-heading">
          <div>
            <p className="farm-setup-eyebrow">LIVE SUMMARY</p>
            <h2 id="farm-summary-heading">Farm setup summary</h2>
          </div>
          <StatusBadge s={r.status} />
        </div>
        <dl className="farm-summary-list">
          <div><dt>Farm or enterprise</dt><dd>{i.description.trim() || "Not entered"}</dd></div>
          <div><dt>Season</dt><dd>{i.season.trim() || "Not entered"}</dd></div>
          <div><dt>Farm area</dt><dd>{areaValue}</dd></div>
          <div className="farm-summary-long"><dt>Equivalent area</dt><dd>{areaEquivalent}</dd></div>
          <div><dt>Main expected yield</dt><dd>{mainYieldValue}</dd></div>
          <div className="farm-summary-long"><dt>Main total output</dt><dd>{mainProduction}</dd></div>
          <div><dt>Alternative yield</dt><dd>{alternativeYieldValue}</dd></div>
          <div className="farm-summary-long"><dt>Alternative total output</dt><dd>{alternativeProduction}</dd></div>
          <div><dt>Expected selling price</dt><dd>{sellingPriceValue}</dd></div>
          <div className="farm-summary-long"><dt>Equivalent price rates</dt><dd>{priceEquivalents}</dd></div>
          <div className="farm-summary-highlight"><dt>Expected gross revenue (whole farm)</dt><dd>{r.main?.grossIncomeFarm !== null && r.main?.grossIncomeFarm !== undefined ? mwk(r.main.grossIncomeFarm) : "Pending"}</dd></div>
          {r.alt && <div><dt>Alternative gross revenue</dt><dd>{r.alt.grossIncomeFarm !== null ? mwk(r.alt.grossIncomeFarm) : "Pending"}</dd></div>}
        </dl>
        <p className="farm-summary-unit-note">Yield and production totals are based on the entered units; farm totals use the converted area.</p>
        <div className="farm-summary-validation" aria-label="Current validation messages" aria-live="polite">
          <h3>Setup validation</h3>
          {blockingIssues.length > 0
            ? <ul>{blockingIssues.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul>
            : <p>No blocking validation issues.</p>}
        </div>
        {r.main && r.status !== "ready" && <p className="farm-summary-provisional">Scenario figures are provisional until the budget is complete.</p>}
      </aside>
    </div>
  </div>;
}
