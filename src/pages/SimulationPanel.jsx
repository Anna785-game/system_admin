import { useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useWs } from "../context/WsContext";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";

const SIM_EVENTS = ["simulation_start", "simulation_day", "simulation_end"];

function formatHeure(ts) {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function SimulationPanel() {
  const { data, loading, reload } = useResource(api.listeCandidats, { refreshOn: ["candidat_actif", "roulette", "retrait", "vire_manuel"] });
  const { events } = useWs();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const actif = (data || []).find((c) => c.statut === "actif");
  const simLog = events.filter((e) => SIM_EVENTS.includes(e.event));

  async function demarrer() {
    if (!actif) return;
    setBusy(true);
    try {
      await api.demarrerSimulation(actif.id);
      toast.success(`Simulation lancée pour ${actif.nom}.`);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Épreuve accélérée</div>
          <h1>Simulation 7 jours</h1>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header"><h2>Candidat éligible</h2></div>
        <div className="panel-body">
          {loading && <div className="empty">Chargement…</div>}
          {!loading && !actif && (
            <div className="empty">
              <strong>Aucun candidat actif</strong>
              Accepte d'abord un candidat depuis l'onglet Candidats, puis fais-lui rouler la roue (enrôlement du visage) avant de lancer la simulation.
            </div>
          )}
          {actif && (
            <div className="active-card">
              <div className="active-card-name">{actif.nom}</div>
              <div className="dim" style={{ fontSize: 12.5, margin: "6px 0 16px" }}>
                {actif.poste_attribue ? <>Poste roulé : <strong>{actif.poste_attribue}</strong></> : "En attente d'enrôlement du visage (roulette pas encore lancée)"}
              </div>
              <button className="btn btn-primary" onClick={demarrer} disabled={busy || !actif.poste_attribue}>
                {busy ? <span className="spinner" /> : <Icon name="bolt" size={14} />}
                Démarrer les 7 jours simulés
              </button>
              {!actif.poste_attribue && (
                <div className="mute" style={{ fontSize: 12, marginTop: 10 }}>
                  Le bouton s'active une fois le visage enrôlé côté téléphone visiteur (déclenche la roulette).
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Journal de simulation</h2>
          <span className="badge badge-mute">{simLog.length}</span>
        </div>
        <div className="panel-body tight">
          {simLog.length === 0 && (
            <div className="empty">
              <strong>Aucune simulation en cours</strong>
              Chaque jour simulé (présence, absence, virage) apparaîtra ici en direct.
            </div>
          )}
          {simLog.length > 0 && (
            <div className="feed-list">
              {simLog.map((ev) => (
                <div key={ev._id} className={`feed-row tone-border-${ev.event === "simulation_end" ? "red" : ev.event === "simulation_start" ? "yellow" : "blue"}`}>
                  <div className="feed-row-icon">{ev.event === "simulation_end" ? "🏁" : ev.event === "simulation_start" ? "▶️" : "📅"}</div>
                  <div className="feed-row-body">
                    <div className="feed-row-text">
                      {ev.event === "simulation_day" && `Jour ${ev.jour} (${ev.date}) — ${ev.candidat?.nom} : ${ev.description} — statut final : ${ev.statut}`}
                      {ev.event === "simulation_start" && (ev.message || `Démarrage pour ${ev.candidat?.nom}`)}
                      {ev.event === "simulation_end" && (ev.message || `Fin (${ev.raison})`)}
                    </div>
                    <div className="feed-row-meta mono">{formatHeure(ev._ts)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
