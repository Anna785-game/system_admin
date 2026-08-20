/**
 * Présence live — une fiche par employé actif.
 * Position = entrée (carte.isentree) ou sortie.
 * Clignote en rouge sur acces_refuse (mauvais visage + bonne carte).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [alertIds, setAlertIds] = useState(() => new Set());
  const alertTimers = useRef(new Map());

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

  // Flash rouge ~2,5 s sur la fiche concernée
  const flashAlert = useCallback((employeId) => {
    if (!employeId) return;
    setAlertIds((prev) => new Set(prev).add(employeId));
    const prevTimer = alertTimers.current.get(employeId);
    if (prevTimer) clearTimeout(prevTimer);
    const t = setTimeout(() => {
      setAlertIds((prev) => {
        const next = new Set(prev);
        next.delete(employeId);
        return next;
      });
      alertTimers.current.delete(employeId);
    }, 2500);
    alertTimers.current.set(employeId, t);
  }, []);

  useEffect(() => {
    return subscribe(["acces_refuse"], (ev) => {
      flashAlert(ev.employe_id);
    });
  }, [subscribe, flashAlert]);

  useEffect(() => () => {
    alertTimers.current.forEach((t) => clearTimeout(t));
  }, []);

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
            const alerte = alertIds.has(e.id);
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