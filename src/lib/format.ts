const nf = (d: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const NA = "n/a";
export const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? NA : nf(d).format(v));
export const mwk = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? NA : `MWK ${nf(d).format(v)}`);
export const pct = (v: number) => `${nf(1).format(v)}%`;
