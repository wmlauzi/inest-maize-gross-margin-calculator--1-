import type { InputHTMLAttributes, ReactNode } from "react";
import { STATUS_MESSAGE, isErrorStatus } from "../calculations/validation.ts";
import type { ItemStatus } from "../types/index.ts";

export const GM_NOTE = "Gross margin = gross income − total variable costs. It is not net profit: fixed costs, overheads, finance costs and taxes are not included.";

export function Num({
  value, onChange, placeholder, id, readOnly, required, onBlur, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedby,
}: { value: number | null; onChange?: (v: number | null) => void; placeholder?: string; id?: string; readOnly?: boolean; required?: boolean } &
  Pick<InputHTMLAttributes<HTMLInputElement>, "onBlur" | "aria-invalid" | "aria-describedby">) {
  return <input className="number-input" id={id} type="number" inputMode="decimal" step="any" min="0" value={value ?? ""} placeholder={placeholder} readOnly={readOnly}
    required={required} aria-invalid={ariaInvalid} aria-describedby={ariaDescribedby} onBlur={onBlur}
    onChange={(e) => onChange?.(e.target.value === "" ? null : Number(e.target.value))} />;
}
export const Field = ({ label, error, children, htmlFor, errorId }: { label: string; error?: string; children: ReactNode; htmlFor?: string; errorId?: string }) =>
  <div className="field shared-field"><label htmlFor={htmlFor}>{label}</label>{children}{error && <div id={errorId} className="err" role="alert">{error}</div>}</div>;

export const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) =>
  <div className="card kpi kpi-card"><div className="l">{label}</div><div className="v">{value}</div>{sub ? <div className="s">{sub}</div> : null}</div>;

export function StatusChip({ status, message }: { status: ItemStatus; message?: string }) {
  const cls = status === "ok" ? "c-ok" : status === "unused" || status === "farm_gate" ? "c-n" : isErrorStatus(status) ? "c-err" : "c-warn";
  return <span className={`chip status-chip ${cls}`}>{message ?? STATUS_MESSAGE[status]}</span>;
}
export const StatusBadge = ({ s }: { s: "not_started" | "in_progress" | "ready" }) =>
  <span className={`chip status-badge ${s === "ready" ? "c-ok" : s === "in_progress" ? "c-warn" : "c-n"}`}>{s === "ready" ? "Ready for review" : s === "in_progress" ? "In progress" : "Not started"}</span>;
