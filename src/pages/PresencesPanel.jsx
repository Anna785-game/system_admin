/**
 * Présence live — remplace l'ancien panneau Présences/Absences redondant.
 *
 * Affiche :
 *  - Qui est actuellement dans l'entreprise (carte.isentree = true)
 *  - Heure d'entrée + temps passé
 *  - Bouton "Forcer sortie" (admin)
 *  - Compteur
 *  - Journal du jour (entrées/sorties via WebSocket déjà dans le feed)
 */

import { useMemo, useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";

function formatDuree(min) {
  if (min === null || min === undefined) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function formatHeure(h) {
  if (!h) return "—";
  // accepte "HH:MM:SS" ou déjà formaté
  return h.length >= 5 ? h.slice(0, 5) : h;
}

async function fetchMeta() {
  const [presents, postes] = await Promise.all([
    api.listePresentsLive(),
    api.listePostes(),
  ]);
  return { presents, postes };
}

export default function PresencesPanel() {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  const { data, loading, error, reload } = useResource(fetchMeta, {
    refreshOn: [
      "entree_entreprise",
      "sortie_entreprise",
      "vire_manuel",
      "simulation_end",
    ],
  });

  const presents = data?.presents || [];
  const posteMap = useMemo(
    () => Object.fromEntries((data?.postes || []).map((p) => [p.id, p.type_poste])),
    [data]
  );

  async function forcerSortie(p) {
    const nom = `${p.nom || ""} ${p.prenom || ""}`.trim() || `#${p.employe_id}`;
    if (!window.confirm(`Forcer la sortie de ${nom} ?`)) return;
    setBusyId(p.employe_id);
    try {
      const res = await api.forceSortie(p.employe_id);
      toast.success(
        `Sortie forcée — ${formatHeure(res.heure_sortie)}` +
          (res.duree_minutes != null ? ` (${formatDuree(res.duree_minutes)})` : "")
      );
      reload();
    } catch (e) {
      toast.error(e.message);
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
          <span className={`badge ${presents.length > 0 ? "badge-green" : "badge-mute"}`}>
            {presents.length} personne{presents.length !== 1 ? "s" : ""} dedans
          </span>
          <button className="btn btn-ghost btn-sm" onClick={reload} disabled={loading}>
            <Icon name="refresh" size={13} />
            Actualiser
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Actuellement dans l&apos;entreprise</h2>
        </div>
        <div className="panel-body tight">
          {loading && !data && <div className="empty">Chargement…</div>}
          {error && <div className="empty">{error}</div>}
          {!loading && presents.length === 0 && (
            <div className="empty">
              <strong>Personne à l&apos;intérieur</strong>
              Les employés apparaissent ici dès qu&apos;ils badgent (carte + visage)
              à l&apos;entrée. Ils disparaissent à la sortie.
            </div>
          )}
          {presents.length > 0 && (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Poste</th>
                    <th>Entrée</th>
                    <th>Temps passé</th>
                    <th>Carte</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {presents.map((p) => (
                    <tr key={p.employe_id}>
                      <td>
                        <strong>
                          {p.nom} {p.prenom || ""}
                        </strong>{" "}
                        <span className="mono dim">#{p.employe_id}</span>
                        <div className="mute mono" style={{ fontSize: 11 }}>
                          {p.matricule}
                        </div>
                      </td>
                      <td>
                        {p.id_poste ? (
                          posteMap[p.id_poste] || `#${p.id_poste}`
                        ) : (
                          <span className="mute">—</span>
                        )}
                      </td>
                      <td className="mono">{formatHeure(p.heure_entree)}</td>
                      <td>
                        <span className="badge badge-green">
                          {formatDuree(p.minutes_depuis)}
                        </span>
                      </td>
                      <td className="mono dim">{p.uidcarte || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => forcerSortie(p)}
                          disabled={busyId === p.employe_id}
                          title="Forcer la sortie (oubli de badge)"
                        >
                          {busyId === p.employe_id ? (
                            <span className="spinner" />
                          ) : (
                            <Icon name="logout" size={13} />
                          )}
                          Sortir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Comment ça marche</h2>
        </div>
        <div className="panel-body">
          <ul className="dim" style={{ fontSize: 13, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            <li>
              Un employé est <strong>présent</strong> dès qu&apos;il présente carte + visage
              et que l&apos;action est une <em>entrée</em>.
            </li>
            <li>
              La prochaine scan (même carte + visage) devient automatiquement une{" "}
              <em>sortie</em> — on enregistre l&apos;heure de sortie et la durée.
            </li>
            <li>
              « Forcer sortie » sert si quelqu&apos;un part sans badger (fin de journée,
              oubli…).
            </li>
            <li>
              Le détail complet d&apos;un employé (toutes les entrées/sorties + graphique)
              se trouve dans l&apos;onglet <strong>Employés</strong> → clic sur une ligne.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
