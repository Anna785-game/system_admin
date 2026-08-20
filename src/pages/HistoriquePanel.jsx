/**
 * Historique journalier.
 *
 * - Sélecteur de date en haut (calendrier natif + flèches J-1 / J+1 / Aujourd'hui)
 * - Titre long : « Jeudi 20 août 2026 »
 * - Liste des employés ayant un événement ce jour-là :
 *     présent (entrée/sortie), absent, ou viré
 * - Clic sur une ligne → détail du jour uniquement (pas de timeline multi-jours)
 * - Rafraîchissement temps réel via WebSocket (entrées, sorties, virages, simu)
 *
 * Un employé n'apparaît un jour J que s'il a une présence, une absence ou un
 * licenciement enregistré pour J. S'il est viré le 21, il n'apparaît plus le 22.
 * S'il est seulement absent le 21, il peut réapparaître le 22 (s'il a un
 * événement ce jour-là).
 */

import { useMemo, useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import Icon from "../components/Icon";

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatTitreLong(iso) {
  const d = parseISODate(iso);
  const s = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // Capitalise le jour de la semaine
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatHeure(h) {
  if (!h) return "—";
  return h.length >= 5 ? h.slice(0, 5) : h;
}

function formatDuree(min) {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

const STATUT_BADGE = {
  present: "badge-green",
  absent: "badge-yellow",
  vire: "badge-red",
};

const STATUT_LABEL = {
  present: "Présent",
  absent: "Absent",
  vire: "Viré",
};

export default function HistoriquePanel() {
  const [jour, setJour] = useState(() => toISODate(new Date()));
  const [selected, setSelected] = useState(null);

  const { data, loading, error, reload } = useResource(
    () => api.historiqueJour(jour),
    {
      deps: [jour],
      refreshOn: [
        "entree_entreprise",
        "sortie_entreprise",
        "vire_manuel",
        "simulation_day",
        "simulation_end",
        "retrait",
      ],
    }
  );

  const lignes = data?.employes || [];

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, vire: 0 };
    for (const e of lignes) {
      if (c[e.statut_jour] != null) c[e.statut_jour] += 1;
    }
    return c;
  }, [lignes]);

  function shiftJour(delta) {
    const d = parseISODate(jour);
    d.setDate(d.getDate() + delta);
    setJour(toISODate(d));
    setSelected(null);
  }

  function goToday() {
    setJour(toISODate(new Date()));
    setSelected(null);
  }

  const detail = selected
    ? lignes.find((e) => e.employe_id === selected) || null
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Archives journalières</div>
          <h1>Historique</h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={13} />
          Actualiser
        </button>
      </div>

      {/* Sélecteur de date */}
      <div
        className="panel"
        style={{ marginBottom: 16, padding: "14px 18px" }}
      >
        <div
          className="flex gap-8"
          style={{
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div className="flex gap-8" style={{ alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => shiftJour(-1)}
              title="Jour précédent"
            >
              ‹
            </button>
            <input
              type="date"
              value={jour}
              onChange={(e) => {
                if (e.target.value) {
                  setJour(e.target.value);
                  setSelected(null);
                }
              }}
              style={{
                fontFamily: "inherit",
                fontSize: 14,
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--border, #333)",
                background: "var(--bg-elevated, #1a1a1a)",
                color: "var(--text)",
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => shiftJour(1)}
              title="Jour suivant"
            >
              ›
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={goToday}>
              Aujourd'hui
            </button>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {formatTitreLong(jour)}
            </div>
            <div className="mute mono" style={{ fontSize: 12, marginTop: 2 }}>
              {counts.present} présent{counts.present !== 1 ? "s" : ""} ·{" "}
              {counts.absent} absent{counts.absent !== 1 ? "s" : ""} ·{" "}
              {counts.vire} viré{counts.vire !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>
            {lignes.length} employé{lignes.length !== 1 ? "s" : ""} ce jour
          </h2>
        </div>
        <div className="panel-body tight">
          {loading && !data && <div className="empty">Chargement…</div>}
          {error && <div className="empty">{error}</div>}
          {!loading && lignes.length === 0 && (
            <div className="empty">
              <strong>Rien pour ce jour</strong>
              Aucune présence, absence ni licenciement enregistré le{" "}
              {formatTitreLong(jour)}.
            </div>
          )}
          {lignes.length > 0 && (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Poste</th>
                    <th>Statut du jour</th>
                    <th>Entrée</th>
                    <th>Sortie</th>
                    <th>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((e) => (
                    <tr
                      key={e.employe_id}
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setSelected(
                          selected === e.employe_id ? null : e.employe_id
                        )
                      }
                      className={selected === e.employe_id ? "row-selected" : ""}
                    >
                      <td>
                        <strong>
                          {e.nom} {e.prenom || ""}
                        </strong>
                      </td>
                      <td>{e.poste || <span className="mute">—</span>}</td>
                      <td>
                        <span
                          className={`badge ${
                            STATUT_BADGE[e.statut_jour] || "badge-mute"
                          }`}
                        >
                          {STATUT_LABEL[e.statut_jour] || e.statut_jour}
                        </span>
                      </td>
                      <td className="mono">
                        {e.statut_jour === "present"
                          ? formatHeure(e.heure_entree)
                          : "—"}
                      </td>
                      <td className="mono">
                        {e.statut_jour === "present"
                          ? formatHeure(e.heure_sortie)
                          : "—"}
                      </td>
                      <td className="mono">
                        {e.statut_jour === "present" && e.duree_minutes != null
                          ? formatDuree(e.duree_minutes)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Détail du jour pour l'employé sélectionné */}
      {detail && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <h2>
              {detail.nom} {detail.prenom || ""} — {formatTitreLong(jour)}
            </h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelected(null)}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
          <div className="panel-body">
            <div className="drawer-meta" style={{ marginBottom: 18 }}>
              <div>
                <span className="mute">Matricule</span>
                <div className="mono">{detail.matricule || "—"}</div>
              </div>
              <div>
                <span className="mute">Poste</span>
                <div>{detail.poste || "—"}</div>
              </div>
              <div>
                <span className="mute">Statut ce jour</span>
                <div>
                  <span
                    className={`badge ${
                      STATUT_BADGE[detail.statut_jour] || "badge-mute"
                    }`}
                  >
                    {STATUT_LABEL[detail.statut_jour] || detail.statut_jour}
                  </span>
                </div>
              </div>
            </div>

            {detail.statut_jour === "vire" && (
              <p className="sous-texte" style={{ margin: 0 }}>
                Licencié ce jour
                {detail.raison ? ` — ${detail.raison}` : "."}
              </p>
            )}

            {detail.statut_jour === "absent" && (
              <p className="sous-texte" style={{ margin: 0 }}>
                Absent
                {detail.raison ? ` — ${detail.raison}` : "."}
              </p>
            )}

            {detail.statut_jour === "present" && (
              <>
                {(detail.evenements || []).length === 0 && (
                  <p className="mute" style={{ margin: 0 }}>
                    Présence enregistrée, détail des pointages indisponible.
                  </p>
                )}
                {(detail.evenements || []).length > 0 && (
                  <div className="parcours-timeline">
                    {detail.evenements.map((ev, i) => (
                      <div
                        key={`${ev.type}-${ev.heure || i}`}
                        className={`parcours-item tone-border-${
                          ev.type === "entree"
                            ? "green"
                            : ev.type === "sortie"
                              ? "blue"
                              : "mute"
                        }`}
                      >
                        <div className="parcours-icon">
                          {ev.type === "entree"
                            ? "→"
                            : ev.type === "sortie"
                              ? "←"
                              : "•"}
                        </div>
                        <div className="parcours-body">
                          <div className="parcours-label">{ev.label}</div>
                          <div className="parcours-meta mono">
                            {ev.heure ? formatHeure(ev.heure) : ""}
                            {ev.duree_minutes != null
                              ? ` · ${formatDuree(ev.duree_minutes)}`
                              : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}