import { useEffect, useState } from "react";
import { getInvite } from "../api";
import { useAuth } from "../AuthContext";

export default function JoinTeamScreen({ inviteToken, onDone }) {
  const { acceptInvite } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getInvite(inviteToken)
      .then(setInvite)
      .catch((err) => setLoadError(err.message));
  }, [inviteToken]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await acceptInvite(inviteToken, name, password);
      onDone();
    } catch (err) {
      setError(err.message || "Could not accept invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 8 }}>
          <span className="brand-mark">✓</span>
          <div>
            <h1>TrustCheck</h1>
            <p>Digital trust &amp; fraud prevention for African businesses</p>
          </div>
        </div>

        {loadError && <p className="form-error" style={{ marginTop: 16 }}>{loadError}</p>}

        {invite && (
          <>
            <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
              You've been invited to join <strong>{invite.orgName}</strong> on TrustCheck as{" "}
              {invite.role === "owner" ? "an owner" : "a team member"}, using {invite.email}.
            </p>
            <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: 16 }}>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Choose a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              {error && <p className="form-error">{error}</p>}
              <button type="submit" disabled={loading}>
                {loading ? "Joining..." : `Join ${invite.orgName}`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
