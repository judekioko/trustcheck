import { useState } from "react";
import TrustCheckForm from "./components/TrustCheckForm";
import SuppliersPanel from "./components/SuppliersPanel";
import "./App.css";

export default function App() {
  const [tab, setTab] = useState("check");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">✓</span>
          <div>
            <h1>TrustCheck</h1>
            <p>Digital trust &amp; fraud prevention for African businesses</p>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === "check" ? "active" : ""} onClick={() => setTab("check")}>
            Run a check
          </button>
          <button className={tab === "suppliers" ? "active" : ""} onClick={() => setTab("suppliers")}>
            Known suppliers
          </button>
        </nav>
      </header>

      <main className="app-main">
        {tab === "check" ? <TrustCheckForm /> : <SuppliersPanel />}
      </main>

      <footer className="app-footer">
        <p>Prototype heuristic engine — not a substitute for your own due diligence. Start with Kenya, built for Africa.</p>
      </footer>
    </div>
  );
}
