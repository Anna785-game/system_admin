import { useState } from "react";
import { API_BASE } from "../api/client";
import { useWs } from "../context/WsContext";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const STATUS_LABEL = {
  idle: "En attente d'un token",
  connecting: "Connexion…",
  open: "Connecté",
  closed: "Coupé — reconnexion auto",
  error: "Erreur de connexion",
};

export default function ReglagesPanel() {
  const { status, token, setToken, reconnectNow } = useWs();
  const { session } = useAuth();
  const [draft, setDraft] = useState(token);

  function save(e) {
    e.preventDefault();
    setToken(draft.trim());
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Configuration</div>
          <h1>Réglages</h1>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-header"><h2>Connexion API</h2></div>
          <div className="panel-body">
            <div className="field">
              <label>Base API (REST)</label>
              <input value={API_BASE} readOnly />
            </div>
            <div className="mute" style={{ fontSize: 12, marginTop: 8 }}>
              Configurée via <code className="mono">VITE_API_BASE</code> au build. Connecté en tant que <span className="mono">{session?.email}</span>.
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>WebSocket régie (/ws/admin)</h2>
            <span className={`badge ${status === "open" ? "badge-green" : status === "connecting" ? "badge-yellow" : "badge-red"}`}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <div className="panel-body">
            <form onSubmit={save} className="field">
              <label htmlFor="ws-token">ADMIN_WS_TOKEN</label>
              <input
                id="ws-token"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="jeton défini côté serveur (settings.ADMIN_WS_TOKEN)"
              />
              <div className="flex gap-8" style={{ marginTop: 10 }}>
                <button className="btn btn-primary btn-sm" type="submit">Enregistrer &amp; connecter</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={reconnectNow}>
                  <Icon name="refresh" size={13} /> Forcer la reconnexion
                </button>
              </div>
            </form>
            <div className="mute" style={{ fontSize: 12, marginTop: 10 }}>
              Ce token est distinct du compte admin : c'est le secret statique du serveur qui protège le flux temps réel projeté.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
