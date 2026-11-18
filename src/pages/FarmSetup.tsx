import { useState } from "react";
import { Field, Num } from "../components/common";
import { useStore } from "../state/store";
import { AREA_UNITS, PRICE_FACTORS, YIELD_FACTORS } from "../data/units.ts";
import type { PageId } from "../App";
import type { AreaUnit, BudgetInputs, PriceUnit, YieldUnit } from "../types/index.ts";

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
  return <div className="farm-setup">
    <header className="farm-setup-intro">
      <div>
        <p className="farm-setup-eyebrow">BUDGET SETUP · STEP 1</p>
        <h1>Farm Setup</h1>
        <p>Enter your farm area, expected maize yield and selling price to build a budget using your own figures.</p>
      </div>
      <div className="farm-setup-progress" aria-label="Budget setup progress">
        <span className="is-current">1 <b>Farm Setup</b></span>
        <i aria-hidden="true" />
        <span>2 <b>Production Costs</b></span>
        <i aria-hidden="true" />
        <span>3 <b>Review</b></span>
      </div>
    </header>

    <section className="farm-form-section" aria-labelledby="farm-area-heading">
      <div className="farm-form-heading">
        <span className="farm-section-number" aria-hidden="true">01</span>
        <div>
          <h2 id="farm-area-heading">Farm area</h2>
          <p>Area is used to calculate whole-farm totals. All production and cost rates are calculated per hectare.</p>
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
      <div className="farm-area-entry">
        <Field label="Farm area (required)" error={err("area")} errorId="area-error" htmlFor="area">
          <div className="row">
            <Num id="area" required value={i.area} aria-invalid={!!err("area")} aria-describedby={err("area") ? "area-error" : undefined}
              onBlur={() => touch("area")} onChange={(v) => set({ area: v })} />
            <select id="areaUnit" required aria-label="Farm area unit" value={i.areaUnit ?? ""} aria-invalid={!!err("areaUnit")}
              aria-describedby={err("areaUnit") ? "areaUnit-error" : undefined} onBlur={() => touch("areaUnit")}
              onChange={(e) => set({ areaUnit: (e.target.value || null) as AreaUnit | null })}>
              <option value="">Select unit</option>{AREA_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
          </div>{unitError("areaUnit")}
        </Field>
        {r.areaHa !== null
          ? <p className="farm-area-conversion" role="status">Equivalent area: <strong>{r.areaHa.toFixed(4)} ha</strong> · {r.areaAcres!.toFixed(2)} acres. Hectares are used for all calculations.</p>
          : <p className="farm-area-help">Enter your total cropped area and select its unit.</p>}
      </div>
    </section>

    <section className="farm-form-section" aria-labelledby="farm-yield-heading">
      <div className="farm-form-heading">
        <span className="farm-section-number" aria-hidden="true">02</span>
        <div>
          <h2 id="farm-yield-heading">Production assumptions</h2>
          <p>Enter expected output for one hectare. The alternative yield is optional and provides a second scenario for comparison.</p>
        </div>
      </div>
      <div className="farm-yield-grid">
        <div className="farm-yield-main">
          <h3>Main scenario <span>Required</span></h3>
          <Field label="Main expected yield (required)" error={err("yieldMain")} errorId="yieldMain-error" htmlFor="ym">
            <div className="row">
              <Num id="ym" required value={i.yieldMain} aria-invalid={!!err("yieldMain")} aria-describedby={err("yieldMain") ? "yieldMain-error" : undefined}
                onBlur={() => touch("yieldMain")} onChange={(v) => set({ yieldMain: v })} />
              <select required aria-label="Main yield unit" value={i.yieldMainUnit ?? ""} aria-invalid={!!err("yieldMainUnit")}
                aria-describedby={err("yieldMainUnit") ? "yieldMainUnit-error" : undefined} onBlur={() => touch("yieldMainUnit")}
                onChange={(e) => set({ yieldMainUnit: (e.target.value || null) as YieldUnit | null })}>
                <option value="">Select unit</option>{Object.keys(YIELD_FACTORS).map((u) => <option key={u} value={u}>{u}</option>)}</select>
            </div>{unitError("yieldMainUnit")}
          </Field>
        </div>
        <div className="farm-yield-alt">
          <h3>Alternative scenario <span>Optional</span></h3>
          <Field label="Alternative expected yield (optional)" error={err("yieldAlt")} errorId="yieldAlt-error" htmlFor="ya">
            <div className="row">
              <Num id="ya" value={i.yieldAlt} aria-invalid={!!err("yieldAlt")} aria-describedby={err("yieldAlt") ? "yieldAlt-error" : undefined}
                onBlur={() => touch("yieldAlt")} onChange={(v) => set({ yieldAlt: v })} />
              <select aria-label="Alternative yield unit" value={i.yieldAltUnit ?? ""} aria-invalid={!!err("yieldAltUnit")}
                aria-describedby={err("yieldAltUnit") ? "yieldAltUnit-error" : undefined} onBlur={() => touch("yieldAltUnit")}
                onChange={(e) => set({ yieldAltUnit: (e.target.value || null) as YieldUnit | null })}>
                <option value="">Select unit</option>{Object.keys(YIELD_FACTORS).map((u) => <option key={u} value={u}>{u}</option>)}</select>
            </div>{unitError("yieldAltUnit")}
          </Field>
        </div>
      </div>
      <p className={`farm-alternative-note ${r.alt === null ? "is-unavailable" : ""}`}>
        {r.alt === null
          ? i.yieldAlt === null
            ? "Alternative scenario not provided. Leave it blank if you do not need a comparison."
            : "Alternative scenario unavailable until the alternative yield and selling price are valid."
          : "The alternative yield is a second scenario for comparison, not a guaranteed forecast."}
      </p>
    </section>

    <section className="farm-form-section farm-price-section" aria-labelledby="farm-price-heading">
      <div className="farm-form-heading">
        <span className="farm-section-number" aria-hidden="true">03</span>
        <div>
          <h2 id="farm-price-heading">Selling price</h2>
          <p>Use the price you expect to receive. Select the unit that matches the amount you enter.</p>
        </div>
      </div>
      <Field label="Maize selling price (required; all expected production is assumed sold)" error={err("price")} errorId="price-error" htmlFor="price">
        <div className="row">
          <Num id="price" required value={i.price} aria-invalid={!!err("price")} aria-describedby={err("price") ? "price-error" : undefined}
            onBlur={() => touch("price")} onChange={(v) => set({ price: v })} />
          <select required aria-label="Selling price unit" value={i.priceUnit ?? ""} aria-invalid={!!err("priceUnit")}
            aria-describedby={err("priceUnit") ? "priceUnit-error" : undefined} onBlur={() => touch("priceUnit")}
            onChange={(e) => set({ priceUnit: (e.target.value || null) as PriceUnit | null })}>
            <option value="">Select unit</option>{Object.keys(PRICE_FACTORS).map((u) => <option key={u} value={u}>{u}</option>)}</select>
        </div>{unitError("priceUnit")}
      </Field>
      <p className="farm-price-note">The entered price applies to all expected production in the calculation.</p>
    </section>

    <div className="farm-setup-actions">
      <button className="btn full-m" onClick={continueToCosts}>Save and continue to costs</button>
    </div>
  </div>;
}
