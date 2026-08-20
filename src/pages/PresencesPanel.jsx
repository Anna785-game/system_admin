/**
 * Présence live — une fiche par employé actif.
 * Position = entrée (carte.isentree) ou sortie.
 * Clignote en rouge sur acces_refuse (mauvais visage + bonne carte).
 * L'alerte reste active jusqu'à clic sur « Stopper » (pas de timeout auto).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useWs } from "../context/WsContext";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";

function formatDuree(min) {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : `${h}h${String(m).padStart(2, "0")}`;
}

function formatHeure(h) {
  if (!h) return "—";
  return h.length >= 5 ? h.slice(0, 5) : h;
}

function formatAlerteDateHeure(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function fetchBoard() {
  const [employes, presents, postes] = await Promise.all([
    api.listeEmployes(),
    api.listePresentsLive(),
    api.listePostes(),
  ]);
  return { employes, presents, postes };
}

export default function PresencesPanel() {
  const toast = useToast();
  const { subscribe } = useWs();
  const [busyId, setBusyId] = useState(null);
  // Map employe_id -> timestamp ISO de l'alerte (persiste jusqu'à Stopper)
  const [alerts, setAlerts] = useState(() => new Map());

  const { data, loading, error, reload } = useResource(fetchBoard, {
    refreshOn: [
      "entree_entreprise",
      "sortie_entreprise",
      "vire_manuel",
      "simulation_end",
      "carte_assignee",
      "employe_actif",
    ],
  });

  const flashAlert = useCallback((employeId, ts) => {
    if (!employeId) return;
    setAlerts((prev) => {
      const next = new Map(prev);
      next.set(employeId, ts || new Date().toISOString());
      return next;
    });
  }, []);

  const stopperAlerte = useCallback((employeId) => {
    setAlerts((prev) => {
      const next = new Map(prev);
      next.delete(employeId);
      return next;
    });
  }, []);

  useEffect(() => {
    return subscribe(["acces_refuse"], (ev) => {
      flashAlert(ev.employe_id, ev._ts || new Date().toISOString());
    });
  }, [subscribe, flashAlert]);

  const posteMap = useMemo(
    () => Object.fromEntries((data?.postes || []).map((p) => [p.id, p.type_poste])),
    [data]
  );

  const presentMap = useMemo(() => {
    const m = new Map();
    for (const p of data?.presents || []) m.set(p.employe_id, p);
    return m;
  }, [data]);

  const actifs = useMemo(
    () => (data?.employes || []).filter((e) => (e.status || "Actif") === "Actif"),
    [data]
  );

  const nbDedans = actifs.filter((e) => presentMap.has(e.id)).length;

  async function forcerSortie(e) {
    const nom = `${e.nom || ""} ${e.prenom || ""}`.trim() || `#${e.id}`;
    if (!window.confirm(`Forcer la sortie de ${nom} ?`)) return;
    setBusyId(e.id);
    try {
      const res = await api.forceSortie(e.id);
      toast.success(
        `Sortie forcée — ${formatHeure(res.heure_sortie)}` +
          (res.duree_minutes != null ? ` (${formatDuree(res.duree_minutes)})` : "")
      );
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Temps réel</div>
          <h1>Présence live</h1>
        </div>
        <div className="flex gap-8" style={{ alignItems: "center" }}>
          <span className={`badge ${nbDedans > 0 ? "badge-green" : "badge-mute"}`}>
            {nbDedans} / {actifs.length} dedans
          </span>
          <button className="btn btn-ghost btn-sm" onClick={reload} disabled={loading}>
            <Icon name="refresh" size={13} />
            Actualiser
          </button>
        </div>
      </div>

      {loading && !data && <div className="empty">Chargement…</div>}
      {error && <div className="empty">{error}</div>}

      {!loading && actifs.length === 0 && (
        <div className="empty">
          <strong>Aucun employé actif</strong>
          Accepte un candidat, enrôle le visage, choisis le poste et attribue une carte.
        </div>
      )}

      {actifs.length > 0 && (
        <div className="presence-board">
          {actifs.map((e) => {
            const live = presentMap.get(e.id);
            const dedans = Boolean(live);
            const alerteTs = alerts.get(e.id);
            const alerte = Boolean(alerteTs);
            const poste = e.id_poste ? posteMap[e.id_poste] || `#${e.id_poste}` : "—";
            const uid = live?.uidcarte /* si live */ || null;

            return (
              <div
                key={e.id}
                className={`presence-card ${dedans ? "in" : "out"} ${alerte ? "alert" : ""}`}
              >
                <div className="presence-card-head">
                  <strong>
                    {e.nom} {e.prenom || ""}
                  </strong>
                  <span className="mono dim">#{e.id}</span>
                </div>

                <div className="presence-card-row">
                  <span className="mute">Poste</span>
                  <span>{poste}</span>
                </div>

                <div className="presence-card-row">
                  <span className="mute">Position</span>
                  <span className={`badge ${dedans ? "badge-green" : "badge-mute"}`}>
                    {dedans ? "Entrée" : "Sortie"}
                  </span>
                </div>

                {dedans && (
                  <div className="presence-card-row">
                    <span className="mute">Depuis</span>
                    <span className="mono">
                      {formatHeure(live.heure_entree)} · {formatDuree(live.minutes_depuis)}
                    </span>
                  </div>
                )}

                <div className="presence-card-row">
                  <span className="mute">Carte</span>
                  <span className="mono dim">{uid || e.matricule /* fallback */ || "—"}</span>
                </div>

                {alerte && (
                  <div
                    className="presence-card-alert"
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--red, #e11)",
                      background: "rgba(220, 38, 38, 0.12)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 12.5, color: "var(--red, #e11)" }}>
                      Alerte le {formatAlerteDateHeure(alerteTs)}
                      <span className="mute" style={{ display: "block", marginTop: 2 }}>
                        Accès refusé (visage non reconnu)
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ width: "100%" }}
                      onClick={() => stopperAlerte(e.id)}
                    >
                      Stopper
                    </button>
                  </div>
                )}

                {dedans && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 10, width: "100%" }}
                    onClick={() => forcerSortie(e)}
                    disabled={busyId === e.id}
                    title="Forcer la sortie"
                  >
                    {busyId === e.id ? <span className="spinner" /> : <Icon name="logout" size={13} />}
                    Sortir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}