import { useEffect, useState } from "react";
import { getTeam, inviteMember, removeMember } from "../api";
import { useAuth } from "../AuthContext";

export default function TeamPanel() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastInviteLink, setLastInviteLink] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getTeam();
      setMembers(data.members);
      setPendingInvites(data.pendingInvites);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function inviteLinkFor(token) {
    const url = new URL(window.location.href);
    url.search = `?invite=${token}`;
    return url.toString();
  }

  async function handleInvite(e) {
    e.preventDefault();
    setError(null);
    try {
      const invite = await inviteMember({ email, role });
      setLastInviteLink(inviteLinkFor(invite.inviteToken));
      setEmail("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(id) {
    if (!confirm("Remove this team member?")) return;
    try {
      await removeMember(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="suppliers-layout">
      <div className="trustcheck-form">
        <h3>Team</h3>
        <p className="hint">Everyone in your organization shares the same suppliers and check history.</p>

        {loading && <p>Loading...</p>}
        {error && <p className="form-error">{error}</p>}

        {!loading && (
          <div className="history-list">
            {members.map((m) => (
              <div key={m.id} className="history-row" style={{ cursor: "default" }}>
                <span className="history-summary">
                  <strong>{m.name}</strong> · {m.email} · {m.role}
                </span>
                {user.role === "owner" && m.id !== user.id && (
                  <button type="button" className="danger" onClick={() => handleRemove(m.id)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="history-row" style={{ cursor: "default", opacity: 0.8 }}>
                <span className="history-summary">
                  Pending: {inv.email} ({inv.role})
                </span>
                {user.role === "owner" && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(inviteLinkFor(inv.token))}
                  >
                    Copy link
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {user.role === "owner" && (
          <>
            <h3 style={{ marginTop: 24 }}>Invite someone</h3>
            <form onSubmit={handleInvite} className="grid-2" style={{ gap: 10 }}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
              <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
                <button type="submit">Send invite</button>
              </div>
            </form>
            {lastInviteLink && (
              <div className="report-placeholder" style={{ textAlign: "left", marginTop: 12 }}>
                <p className="hint">Share this link with them (e.g. via WhatsApp) — it's also always available above under "Pending":</p>
                <code style={{ wordBreak: "break-all", fontSize: 12 }}>{lastInviteLink}</code>
              </div>
            )}
          </>
        )}
      </div>

      <div className="suppliers-list">
        <div className="supplier-card">
          <p className="hint" style={{ margin: 0 }}>
            {user.org.plan === "pro"
              ? "Pro plan allows up to 10 team members."
              : "Free plan allows 1 team member. Upgrade to Pro for up to 10 — see the Billing tab."}
          </p>
        </div>
      </div>
    </div>
  );
}
