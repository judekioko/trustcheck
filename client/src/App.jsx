import { useState } from "react";
import TrustCheckForm from "./components/TrustCheckForm";
import SuppliersPanel from "./components/SuppliersPanel";
import HistoryPanel from "./components/HistoryPanel";
import AuthScreen from "./components/AuthScreen";
import JoinTeamScreen from "./components/JoinTeamScreen";
import TeamPanel from "./components/TeamPanel";
import BillingPanel from "./components/BillingPanel";
import AdminPanel from "./components/AdminPanel";
import { useAuth } from "./AuthContext";
import "./App.css";

function getInviteTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("invite");
}

export default function App() {
  const [tab, setTab] = useState("check");
  const { user, loading, logout } = useAuth();
  const inviteToken = getInviteTokenFromUrl();

  if (loading) {
    return <div className="app-loading">Loading TrustCheck...</div>;
  }

  if (!user && inviteToken) {
    return (
      <JoinTeamScreen
        inviteToken={inviteToken}
        onDone={() => {
          window.history.replaceState({}, "", window.location.pathname);
        }}
      />
    );
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
          <button className={tab === "team" ? "active" : ""} onClick={() => setTab("team")}>
            Team
          </button>
          <button className={tab === "billing" ? "active" : ""} onClick={() => setTab("billing")}>
            Billing
          </button>
          {user.isPlatformAdmin && (
            <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>
              Admin
            </button>
          )}
        </nav>
        <div className="account-box">
          <span className="account-name">
            {user.name} · {user.org.name}
            <span className={`plan-pill plan-${user.org.plan}`}>{user.org.plan}</span>
          </span>
          <button type="button" className="secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="app-main">
        {tab === "check" && <TrustCheckForm onNavigateToBilling={() => setTab("billing")} />}
        {tab === "history" && <HistoryPanel />}
        {tab === "suppliers" && <SuppliersPanel />}
        {tab === "team" && <TeamPanel />}
        {tab === "billing" && <BillingPanel />}
        {tab === "admin" && user.isPlatformAdmin && <AdminPanel />}
      </main>

      <footer className="app-footer">
        <p>Heuristic engine — not a substitute for your own due diligence. Start with Kenya, built for Africa.</p>
      </footer>
    </div>
  );
}
