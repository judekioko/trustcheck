import { useState } from "react";
import TrustCheckForm from "./components/TrustCheckForm";
import SuppliersPanel from "./components/SuppliersPanel";
import HistoryPanel from "./components/HistoryPanel";
import AuthScreen from "./components/AuthScreen";
import { useAuth } from "./AuthContext";
import "./App.css";

export default function App() {
  const [tab, setTab] = useState("check");
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div className="app-loading">Loading TrustCheck...</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

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
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
            History
          </button>
          <button className={tab === "suppliers" ? "active" : ""} onClick={() => setTab("suppliers")}>
            Known suppliers
          </button>
        </nav>
        <div className="account-box">
          <span className="account-name">{user.businessName}</span>
          <button type="button" className="secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="app-main">
        {tab === "check" && <TrustCheckForm />}
        {tab === "history" && <HistoryPanel />}
        {tab === "suppliers" && <SuppliersPanel />}
      </main>

      <footer className="app-footer">
        <p>Heuristic engine — not a substitute for your own due diligence. Start with Kenya, built for Africa.</p>
      </footer>
    </div>
  );
}
