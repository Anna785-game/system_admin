/**
 * Historique journalier — mode Normal | Simulation
 * - Recherche par nom
 * - Clic nom → parcours multi-jours
 * - Clic jour → détail entrées/sorties de ce jour
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
  const [mode, setMode] = useState("normal"); // "normal" | "simulation"
  const [jour, setJour] = useState(() => toISODate(new Date()));
  const [search, setSearch] = useState("");
  // vue : "jour" | "parcours" | "jour-detail"
  const [vue, setVue] = useState("jour");
  const [selectedEmp, setSelectedEmp] = useState(null); // ligne du jour
  const [parcours, setParcours] = useState(null);
  const [parcoursLoading, setParcoursLoading] = useState(false);
  const [jourDetail, setJourDetail] = useState(null); // date ISO dans le parcours

  const { data, loading, error, reload } = useResource(
    () => api.historiqueJour(jour, mode),
    {
      deps: [jour, mode],
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

  const filtrées = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lignes;
    return lignes.filter((e) => {
      const nom = `${e.nom || ""} ${e.prenom || ""}`.toLowerCase();
      const mat = (e.matricule || "").toLowerCase();
      return nom.includes(q) || mat.includes(q);
    });
  }, [lignes, search]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, vire: 0 };
    for (const e of filtrées) {
      if (c[e.statut_jour] != null) c[e.statut_jour] += 1;
    }
    return c;
  }, [filtrées]);

  function shiftJour(delta) {
    const d = parseISODate(jour);
    d.setDate(d.getDate() + delta);
    setJour(toISODate(d));
    setSelectedEmp(null);
    setVue("jour");
  }

  function goToday() {
    setJour(toISODate(new Date()));
    setSelectedEmp(null);
    setVue("jour");
  }

  async function ouvrirParcours(emp) {
    setSelectedEmp(emp);
    setVue("parcours");
    setParcours(null);
    setJourDetail(null);
    setParcoursLoading(true);
    try {
      const p = await api.parcoursEmploye(emp.employe_id);
      setParcours(p);
    } catch {
      setParcours(null);
    } finally {
      setParcoursLoading(false);
    }
  }

  // Grouper le timeline par date
  const joursParcours = useMemo(() => {
    if (!parcours?.timeline) return [];
    const map = new Map();
    for (const ev of parcours.timeline) {
      if (!map.has(ev.date)) map.set(ev.date, []);
      map.get(ev.date).push(ev);
    }
    // plus récent en premier
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [parcours]);

  function resumeJour(events) {
    const hasVire = events.some(
      (e) => e.type === "absence" && (e.detail || "").startsWith("Viré")
    );
    if (hasVire) return { statut: "vire", label: "Viré" };
    const hasAbs = events.some((e) => e.type === "absence");
    if (hasAbs) return { statut: "absent", label: "Absent" };
    return { statut: "present", label: "Présent" };
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Archives journalières</div>
          <h1>
            {mode === "simulation" ? "Historique simulation" : "Historique"}
          </h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={13} />
          Actualiser
        </button>
      </div>

      {/* Toggle Normal / Simulation */}
      <div className="flex gap-8" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          className={`btn btn-sm ${mode === "normal" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => {
            setMode("normal");
            setVue("jour");
            setSelectedEmp(null);
          }}
        >
          Historique normal
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === "simulation" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => {
            setMode("simulation");
            setVue("jour");
            setSelectedEmp(null);
          }}
        >
          Historique simulation
        </button>
      </div>

      {/* Recherche */}
      <div className="panel" style={{ marginBottom: 16, padding: "12px 18px" }}>
        <input
          type="search"
          placeholder="Rechercher un nom ou matricule…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 360,
            fontFamily: "inherit",
            fontSize: 14,
            padding: "8px 12px",
			color: "#1a1a1a",
			backgroundColor: "#fff",
          }}
        />
      </div>

      {/* Sélecteur de date (vue jour) */}
      {vue === "jour" && (
        <div className="panel" style={{ marginBottom: 16, padding: "14px 18px" }}>
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
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftJour(-1)}>
                ‹
              </button>
              <input
                type="date"
                value={jour}
                onChange={(e) => {
                  if (e.target.value) {
                    setJour(e.target.value);
                    setSelectedEmp(null);
                  }
                }}
                style={{ fontFamily: "inherit", fontSize: 14, padding: "6px 10px", color: "#1a1a1a", backgroundColor: "#fff" }}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftJour(1)}>
                ›
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={goToday}>
                Aujourd'hui
              </button>
            </div>
            <strong>{formatTitreLong(jour)}</strong>
            <div className="flex gap-8">
              <span className="badge badge-green">{counts.present} présent</span>
              <span className="badge badge-yellow">{counts.absent} absent</span>
              <span className="badge badge-red">{counts.vire} viré</span>
            </div>
          </div>
        </div>
      )}

      {/* Liste du jour */}
      {vue === "jour" && (
        <section className="panel">
          <div className="panel-header">
            <h2>
              {mode === "simulation" ? "Simulations ce jour" : "Employés ce jour"}
            </h2>
          </div>
          <div className="panel-body tight">
            {loading && !data && <div className="empty">Chargement…</div>}
            {error && <div className="empty">{error}</div>}
            {!loading && filtrées.length === 0 && (
              <div className="empty">
                <strong>Personne ce jour</strong>
                {search
                  ? "Aucun résultat pour cette recherche."
                  : mode === "simulation"
                    ? "Aucune simulation n'a d'événement à cette date."
                    : "Aucun pointage / absence / virage enregistré."}
              </div>
            )}
            {filtrées.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Poste</th>
                      <th>Statut</th>
                      <th>Entrée</th>
                      <th>Sortie</th>
                      <th>Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrées.map((e) => (
                      <tr
                        key={e.employe_id}
                        style={{ cursor: "pointer" }}
                        onClick={() => ouvrirParcours(e)}
                      >
                        <td>
                          <strong>
                            {e.nom} {e.prenom || ""}
                          </strong>
                          <div className="mono dim" style={{ fontSize: 11 }}>
                            {e.matricule}
                          </div>
                        </td>
                        <td>{e.poste || <span className="mute">—</span>}</td>
                        <td>
                          <span className={`badge ${STATUT_BADGE[e.statut_jour] || "badge-mute"}`}>
                            {STATUT_LABEL[e.statut_jour] || e.statut_jour}
                          </span>
                        </td>
                        <td className="mono">
                          {e.statut_jour === "present" ? formatHeure(e.heure_entree) : "—"}
                        </td>
                        <td className="mono">
                          {e.statut_jour === "present" ? formatHeure(e.heure_sortie) : "—"}
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
      )}

      {/* Parcours multi-jours */}
      {vue === "parcours" && selectedEmp && (
        <section className="panel">
          <div className="panel-header">
            <h2>
              Parcours — {selectedEmp.nom} {selectedEmp.prenom || ""}
            </h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setVue("jour");
                setParcours(null);
                setJourDetail(null);
              }}
            >
              <Icon name="x" size={13} /> Retour au jour
            </button>
          </div>
          <div className="panel-body">
            <div className="drawer-meta" style={{ marginBottom: 18 }}>
              <div>
                <span className="mute">Matricule</span>
                <div className="mono">{selectedEmp.matricule || "—"}</div>
              </div>
              <div>
                <span className="mute">Poste</span>
                <div>{selectedEmp.poste || "—"}</div>
              </div>
            </div>

            {parcoursLoading && <div className="empty">Chargement du parcours…</div>}
            {!parcoursLoading && joursParcours.length === 0 && (
              <div className="empty">Aucun événement enregistré pour cet employé.</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {joursParcours.map(([dateISO, events]) => {
                const r = resumeJour(events);
                return (
                  <button
                    key={dateISO}
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      textAlign: "left",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      border: "1px solid var(--border, #333)",
                      borderRadius: 8,
                    }}
                    onClick={() => {
                      setJourDetail(dateISO);
                      setVue("jour-detail");
                    }}
                  >
                    <span>
                      <strong>{formatTitreLong(dateISO)}</strong>
                      <span className="mute" style={{ marginLeft: 10, fontSize: 12 }}>
                        {events.length} événement{events.length > 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className={`badge ${STATUT_BADGE[r.statut] || "badge-mute"}`}>
                      {r.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Détail d'un jour du parcours */}
      {vue === "jour-detail" && selectedEmp && jourDetail && (
        <section className="panel">
          <div className="panel-header">
            <h2>
              {selectedEmp.nom} — {formatTitreLong(jourDetail)}
            </h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setVue("parcours");
                setJourDetail(null);
              }}
            >
              <Icon name="x" size={13} /> Retour au parcours
            </button>
          </div>
          <div className="panel-body">
            <div className="parcours-timeline">
              {(joursParcours.find(([d]) => d === jourDetail)?.[1] || []).map((ev, i) => (
                <div
                  key={`${ev.type}-${ev.heure || i}`}
                  className={`parcours-item tone-border-${
                    ev.type === "entree"
                      ? "green"
                      : ev.type === "sortie"
                        ? "blue"
                        : ev.type === "absence"
                          ? "red"
                          : "mute"
                  }`}
                >
                  <div className="parcours-icon">
                    {ev.type === "entree" ? "→" : ev.type === "sortie" ? "←" : "•"}
                  </div>
                  <div className="parcours-body">
                    <div className="parcours-label">{ev.label}</div>
                    {ev.detail && (
                      <div className="parcours-meta" style={{ marginTop: 2 }}>
                        {ev.detail}
                      </div>
                    )}
                    <div className="parcours-meta mono">
                      {ev.heure ? formatHeure(ev.heure) : ""}
                      {ev.duree_minutes != null ? ` · ${formatDuree(ev.duree_minutes)}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}