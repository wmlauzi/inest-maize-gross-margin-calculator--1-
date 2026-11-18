import { useState } from "react";
import { CONVERTER_PRICE_UNITS, MASS_UNITS, areaToHa, convertMass, convertPrice, haToAcres, truckloadPrice, type ConverterPriceUnit } from "../calculations/conversions.ts";
import { Field, Num } from "./common";
import { fmt } from "../lib/format";
import type { UnitName } from "../types/index.ts";

/** Stand-alone helpers: they never change the budget. */
export default function Converters() {
  const [w, setW] = useState<number | null>(null); const [wu, setWu] = useState<UnitName>("50 kg bag");
  const [a, setA] = useState<number | null>(null); const [au, setAu] = useState<"ha" | "acres">("ha");
  const [p, setP] = useState<number | null>(null); const [pu, setPu] = useState<ConverterPriceUnit>("MWK per 50 kg bag");
  const [lp, setLp] = useState<number | null>(null); const [lt, setLt] = useState<number | null>(null);
  const ha = a === null ? null : areaToHa(a, au); const pr = p === null ? null : convertPrice(p, pu); const tl = lp === null || lt === null ? null : truckloadPrice(lp, lt);
  return <div className="grid g2 converter-grid">
    <div className="card converter-card"><h3 className="converter-title">Weight converter</h3><Field label="Weight" htmlFor="converter-weight"><div className="row converter-input-row"><Num id="converter-weight" value={w} onChange={setW} /><select aria-label="Weight unit" value={wu} onChange={(e) => setWu(e.target.value as UnitName)}>{MASS_UNITS.map((u) => <option key={u}>{u}</option>)}</select></div></Field>
      <div className="converter-results" role="group" aria-label="Weight conversions">{MASS_UNITS.map((u) => <div key={u} className="converter-result"><span>{u}</span><b>{w === null ? "–" : fmt(convertMass(w, wu, u), 4)}</b></div>)}</div></div>
    <div className="card converter-card"><h3 className="converter-title">Farm area converter</h3><Field label="Farm area" htmlFor="converter-area"><div className="row converter-input-row"><Num id="converter-area" value={a} onChange={setA} /><select aria-label="Area unit" value={au} onChange={(e) => setAu(e.target.value as never)}><option>ha</option><option>acres</option></select></div></Field>
      <div className="converter-results" role="group" aria-label="Area conversions"><div className="converter-result"><span>Hectares</span><b>{ha === null ? "–" : fmt(ha, 4)}</b></div><div className="converter-result"><span>Acres</span><b>{ha === null ? "–" : fmt(haToAcres(ha), 4)}</b></div></div></div>
    <div className="card converter-card"><h3 className="converter-title">Maize price converter</h3><Field label="Maize price" htmlFor="converter-price"><div className="row converter-input-row"><Num id="converter-price" value={p} onChange={setP} /><select aria-label="Price unit" value={pu} onChange={(e) => setPu(e.target.value as ConverterPriceUnit)}>{CONVERTER_PRICE_UNITS.map((u) => <option key={u}>{u}</option>)}</select></div></Field>
      <div className="converter-results" role="group" aria-label="Maize price conversions">{([["per kg", pr?.perKg], ["per tonne", pr?.perTonne], ["per 50 kg bag", pr?.per50kgBag], ["per 25 kg bag", pr?.per25kgBag]] as const).map(([l, v]) => <div key={l} className="converter-result"><span>MWK {l}</span><b>{v === undefined ? "–" : fmt(v, 2)}</b></div>)}</div></div>
    <div className="card converter-card"><h3 className="converter-title">Transport converter</h3><Field label="Price per truckload (MWK)" htmlFor="converter-truck-price"><Num id="converter-truck-price" value={lp} onChange={setLp} /></Field><Field label="Tonnes carried per load" htmlFor="converter-truck-tonnes"><Num id="converter-truck-tonnes" value={lt} onChange={setLt} /></Field>
      <div className="converter-results" role="group" aria-label="Transport conversions"><div className="converter-result"><span>Per tonne</span><b>{tl ? fmt(tl.perTonne, 2) : "–"}</b></div><div className="converter-result"><span>Per 50 kg bag</span><b>{tl ? fmt(tl.per50kgBag, 2) : "–"}</b></div><div className="converter-result"><span>Per kg</span><b>{tl ? fmt(tl.perKg, 4) : "–"}</b></div></div></div>
  </div>;
}
