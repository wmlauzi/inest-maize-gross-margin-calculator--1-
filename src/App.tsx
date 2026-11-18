import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import logo from "./assets/inest-logo.png";
import { useStore } from "./state/store";
import Dashboard from "./pages/Dashboard";
import FarmSetup from "./pages/FarmSetup";
import ProductionCosts from "./pages/ProductionCosts";
import Results from "./pages/Results";
import Reports from "./pages/Reports";

export const PAGES = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" }, { id: "farm", label: "Farm Setup", icon: "farm" },
  { id: "costs", label: "Production Costs", icon: "costs" }, { id: "results", label: "Results", icon: "results" }, { id: "reports", label: "Reports", icon: "reports" },
] as const;
export type PageId = (typeof PAGES)[number]["id"];
const fromHash = (): PageId => (PAGES.find((p) => p.id === location.hash.slice(1))?.id ?? "dashboard");

function NavigationIcon({ name }: { name: (typeof PAGES)[number]["icon"] }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, "aria-hidden": true };
  if (name === "dashboard") return <svg {...common}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>;
  if (name === "farm") return <svg {...common}><path d="M12 2a9 9 0 0 0-9 9c0 4.1 2.8 7.6 6.7 8.6L12 22l2.3-2.4C18.2 18.6 21 15.1 21 11a9 9 0 0 0-9-9z"/><path d="M12 8v4M10 10h4"/></svg>;
  if (name === "costs") return <svg {...common}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/><path d="M8 7h6M8 11h8M8 15h5"/></svg>;
  if (name === "results") return <svg {...common}><path d="M3 3v18h18"/><path d="m7 16 4-4 3 3 5-6"/></svg>;
  return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg>;
}

export default function App() {
  const [page, setPage] = useState<PageId>(fromHash);
  const [open, setOpen] = useState(false);
  const { saveStatus, persistenceMessage } = useStore();
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawerCloseButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { const h = () => setPage(fromHash()); addEventListener("hashchange", h); return () => removeEventListener("hashchange", h); }, []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerCloseButton.current?.focus();
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const closeMenu = () => {
    setOpen(false);
    if (window.matchMedia("(max-width: 900px)").matches) menuButton.current?.focus();
  };
  const go = (p: PageId) => {
    location.hash = p;
    setPage(p);
    setOpen(false);
    if (window.matchMedia("(max-width: 900px)").matches) menuButton.current?.focus();
    window.scrollTo(0, 0);
  };
  const closeMenuOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      setOpen(false);
      menuButton.current?.focus();
    }
  };
  const View = { dashboard: Dashboard, farm: FarmSetup, costs: ProductionCosts, results: Results, reports: Reports }[page];
  const currentPageLabel = PAGES.find((item) => item.id === page)?.label ?? "Dashboard";
  return (
    <div className="shell">
      <header className="top">
        <button ref={menuButton} className="menu-toggle" type="button" aria-controls="main-navigation" aria-expanded={open}
          aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => open ? closeMenu() : setOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
        </button>
        <div className="mobile-brand">
          <img src={logo} alt="" />
          <div><strong>iNest Agro</strong><span>{currentPageLabel}</span></div>
        </div>
        <span className="mobile-save-status" role="status">{saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Needs attention" : "Saved"}</span>
      </header>
      {open && <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation" onClick={closeMenu} tabIndex={-1}/>}
      <nav id="main-navigation" className={`side ${open ? "open" : ""}`} aria-label="Main" onKeyDown={closeMenuOnEscape}>
        <div className="side-brand">
          <div className="plate"><img src={logo} alt="iNest Agro" /></div>
          <button ref={drawerCloseButton} className="drawer-close" type="button" aria-label="Close navigation" onClick={closeMenu}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <div className="side-brand-copy">
            <strong>iNest Agro</strong>
            <span>Maize Gross Margin Calculator</span>
            <small>Smarter Farming. Better Decisions.</small>
          </div>
        </div>
        <div className="nav-heading">Application Menu</div>
        <div className="nav-list">
          {PAGES.map((p) => <button key={p.id} className={`nav ${page === p.id ? "on" : ""}`} aria-current={page === p.id ? "page" : undefined} onClick={() => go(p.id)}>
            <span className="nav-icon"><NavigationIcon name={p.icon}/></span><span>{p.label}</span>
          </button>)}
        </div>
      </nav>
      <main className="main">
        {persistenceMessage && <div className="persistence-alert" role="alert">{persistenceMessage}</div>}
        <div className="wrap"><View go={go} /></div>
      </main>
    </div>
  );
}
