import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!email || !password) return;
    login(email, password);
  }

  return (
    <div className="login-screen">
      <div className="login-card panel">
        <div className="login-mark">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" stroke="var(--gold)" strokeWidth="2" />
            <path d="M20 2 A18 18 0 0 1 35.6 11" stroke="var(--red)" strokeWidth="3" strokeLinecap="round" />
            <path d="M35.6 29 A18 18 0 0 1 20 38" stroke="var(--yellow)" strokeWidth="3" strokeLinecap="round" />
            <path d="M4.4 29 A18 18 0 0 1 4.4 11" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="20" cy="20" r="4" fill="var(--gold-bright)" />
          </svg>
        </div>
        <div className="eyebrow">Accès restreint</div>
        <h1>Poste de contrôle</h1>
        <p className="dim login-sub">Connexion administrateur — Système de Sécurité &amp; Pointage</p>

        <form onSubmit={submit} className="login-form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@expo.local"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? "Connexion…" : "Entrer dans la régie"}
          </button>
        </form>
      </div>
    </div>
  );
}
