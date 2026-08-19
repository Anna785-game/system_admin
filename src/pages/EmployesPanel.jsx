/**
 * Employés — liste + recherche + drawer détail avec timeline + graphique
 * des durées de travail.
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

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

async function fetchList() {
  const [employes, postes] = await Promise.all([
    api.listeEmployes(),
    api.listePostes(),
  ]);
  return { employes, postes };
}

// ---------- Mini graphique barres (CSS pur) ----------
function DureeBars({ durees }) {
  if (!durees || durees.length === 0) {
    return (
      <div className="empty" style={{ padding: "12px 0" }}>
        Aucune durée enregistrée pour le moment.
      </div>
    );
  }
  // Prend les 14 derniers jours max, triés chrono
  const sorted = [...durees]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);
  const max = Math.max(...sorted.map((d) => d.duree_minutes), 1);

  return (
    <div className="duree-bars">
      {sorted.map((d) => {
        const pct = Math.round((d.duree_minutes / max) * 100);
        return (
          <div key={d.date} className="duree-bar-col" title={`${d.date} · ${formatDuree(d.duree_minutes)}`}>
            <div className="duree-bar-track">
              <div
                className="duree-bar-fill"
                style={{ height: `${pct}%` }}
              />
            </div>
            <div className="duree-bar-label mono">
              {d.date.slice(8)}/{d.date.slice(5, 7)}
            </div>
            <div className="duree-bar-val mono dim">{formatDuree(d.duree_minutes)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Timeline ----------
function Timeline({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="empty" style={{ padding: "12px 0" }}>
        Aucun événement de pointage pour cet employé.
      </div>
    );
  }

  const tone = {
    entree: "green",
    sortie: "blue",
    absence: "red",
    presence_jour: "mute",
  };

  const icon = {
    entree: "→",
    sortie: "←",
    absence: "✕",
    presence_jour: "•",
  };

  return (
    <div className="parcours-timeline">
      {events.map((ev, i) => (
        <div
          key={`${ev.type}-${ev.date}-${ev.heure || i}`}
          className={`parcours-item tone-border-${tone[ev.type] || "mute"}`}
        >
          <div className="parcours-icon">{icon[ev.type] || "•"}</div>
          <div className="parcours-body">
            <div className="parcours-label">{ev.label}</div>
            <div className="parcours-meta mono">
              {formatDate(ev.date)}
              {ev.heure ? ` · ${ev.heure.slice(0, 5)}` : ""}
              {ev.detail ? ` · ${ev.detail}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Drawer détail ----------
function EmployeDrawer({ employeId, postes, onClose }) {
  const { data, loading, error } = useResource(
    () => api.parcoursEmploye(employeId),
    { deps: [employeId], refreshOn: ["entree_entreprise", "sortie_entreprise"] }
  );

  const posteNom = data?.id_poste
    ? postes.find((p) => p.id === data.id_poste)?.type_poste || `#${data.id_poste}`
    : null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="eyebrow">Parcours</div>
            <h2>
              {loading ? "…" : `${data?.nom || ""} ${data?.prenom || ""}`.trim() || `#${employeId}`}
            </h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="drawer-body">
          {loading && <div className="empty">Chargement du parcours…</div>}
          {error && <div className="empty">{error}</div>}
          {data && (
            <>
              <div className="drawer-meta">
                <div>
                  <span className="mute">Matricule</span>
                  <div className="mono">{data.matricule}</div>
                </div>
                <div>
                  <span className="mute">Statut</span>
                  <div>
                    <span
                      className={`badge ${
                        data.status === "Actif" ? "badge-green" : "badge-red"
                      }`}
                    >
                      {data.status}
                    </span>
                    {data.is_present && (
                      <span className="badge badge-green" style={{ marginLeft: 6 }}>
                        Présent
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="mute">Poste</span>
                  <div>{posteNom || <span className="mute">—</span>}</div>
                </div>
              </div>

              <section style={{ marginTop: 28 }}>
                <h3 style={{ marginBottom: 12, fontSize: 14 }}>Durée de travail (jours)</h3>
                <DureeBars durees={data.durees_par_jour} />
              </section>

              <section style={{ marginTop: 28 }}>
                <h3 style={{ marginBottom: 12, fontSize: 14 }}>
                  Timeline ({data.timeline.length})
                </h3>
                <Timeline events={data.timeline} />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Page principale ----------
export default function EmployesPanel() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(null);

  const { data, loading, error, reload } = useResource(fetchList, {
    refreshOn: [
      "employe_actif",
      "roulette",
      "vire_manuel",
      "entree_entreprise",
      "sortie_entreprise",
      "simulation_end",
    ],
  });

  const employes = data?.employes || [];
  const postes = data?.postes || [];
  const posteMap = useMemo(
    () => Object.fromEntries(postes.map((p) => [p.id, p.type_poste])),
    [postes]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employes;
    return employes.filter((e) => {
      const nom = `${e.nom || ""} ${e.prenom || ""}`.toLowerCase();
      return (
        nom.includes(q) ||
        String(e.id).includes(q) ||
        (e.matricule || "").toLowerCase().includes(q)
      );
    });
  }, [employes, search]);

  async function supprimer(e) {
    if (!window.confirm(`Supprimer ${e.nom} (${e.matricule}) ?`)) return;
    setBusy(e.id);
    try {
      await api.supprimerEmploye(e.id);
      toast.success("Employé supprimé.");
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Effectif</div>
          <h1>Employés</h1>
        </div>
        <div className="field" style={{ width: 260 }}>
          <input
            type="search"
            placeholder="Rechercher nom, matricule, #id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>
            {filtered.length} employé{filtered.length !== 1 ? "s" : ""}
            {search && ` (filtre « ${search} »)`}
          </h2>
        </div>
        <div className="panel-body tight">
          {loading && !data && <div className="empty">Chargement…</div>}
          {error && <div className="empty">{error}</div>}
          {!loading && filtered.length === 0 && (
            <div className="empty">
              <strong>Aucun employé</strong>
              {search
                ? "Aucun résultat pour cette recherche."
                : "Les employés apparaissent après acceptation d'un candidat."}
            </div>
          )}
          {filtered.length > 0 && (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Matricule</th>
                    <th>Poste</th>
                    <th>Statut</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedId(e.id)}
                    >
                      <td>
                        <strong>
                          {e.nom} {e.prenom || ""}
                        </strong>{" "}
                        <span className="mono dim">#{e.id}</span>
                      </td>
                      <td className="mono">{e.matricule}</td>
                      <td>
                        {e.id_poste ? (
                          posteMap[e.id_poste] || `#${e.id_poste}`
                        ) : (
                          <span className="mute">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            e.status === "Actif" ? "badge-green" : "badge-red"
                          }`}
                        >
                          {e.status || "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }} onClick={(ev) => ev.stopPropagation()}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelectedId(e.id)}
                          title="Voir le parcours"
                        >
                          <Icon name="history" size={13} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => supprimer(e)}
                          disabled={busy === e.id}
                          title="Supprimer"
                        >
                          {busy === e.id ? (
                            <span className="spinner" />
                          ) : (
                            <Icon name="trash" size={13} />
                          )}
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

      {selectedId && (
        <EmployeDrawer
          employeId={selectedId}
          postes={postes}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
