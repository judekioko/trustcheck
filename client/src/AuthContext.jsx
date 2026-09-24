import { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    if (!api.getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.fetchMe();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
    const onUnauthorized = () => setUser(null);
    window.addEventListener("trustcheck:unauthorized", onUnauthorized);
    return () => window.removeEventListener("trustcheck:unauthorized", onUnauthorized);
  }, [hydrate]);

  async function login(email, password) {
    const { token, user } = await api.login({ email, password });
    api.setToken(token);
    setUser(user);
  }

  async function register(name, orgName, email, password) {
    const { token, user } = await api.register({ name, orgName, email, password });
    api.setToken(token);
    setUser(user);
  }

  async function acceptInvite(inviteToken, name, password) {
    const { token, user } = await api.acceptInvite(inviteToken, { name, password });
    api.setToken(token);
    setUser(user);
  }

  function logout() {
    api.setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, acceptInvite, logout, refresh: hydrate }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
