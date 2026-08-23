/**
 * Historique journalier — mode Normal | Simulation
 * - Recherche par nom / matricule : GLOBALE (tous les employés, indépendante du jour)
 * - Sans recherche : vue jour par jour (comme avant)
 * - Clic nom → parcours multi-jours
 * - Clic jour → détail entrées/sorties de ce jour
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import Icon from "../components/Icon";
import ParcoursModal from "../components/ParcoursModal";

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
  Actif: "badge-green",
  Inactif: "badge-red",
};

const STATUT_LABEL = {
  present: "Présent",
  absent: "Absent",
  vire: "Viré",
  Actif: "Actif",
  Inactif: "Inactif",
};

export default function HistoriquePanel() {
  const [mode, setMode] = useState("normal"); // "normal" | "simulation"
  const [jour, setJour] = useState(() => toISODate(new Date()));
  const [search, setSearch] = useState("");
  const [parcoursEmp, setParcoursEmp] = useState(null); // employé affiché dans le modal parcours

  // --- Données du jour (quand pas de recherche) ---
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

  // --- Liste globale des employés (pour la recherche indépendante du jour) ---
  const [allEmployes, setAllEmployes] = useState([]);
  const [allPostes, setAllPostes] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGlobalLoading(true);
      try {
        const [emps, postes] = await Promise.all([
          api.listeEmployes(),
          api.listePostes(),
        ]);
        if (!cancelled) {
          setAllEmployes(emps || []);
          setAllPostes(postes || []);
        }
      } catch {
        if (!cancelled) {
          setAllEmployes([]);
          setAllPostes([]);
        }
      } finally {
        if (!cancelled) setGlobalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const posteMap = useMemo(
    () => Object.fromEntries((allPostes || []).map((p) => [p.id, p.type_poste])),
    [allPostes]
  );

  const q = search.trim().toLowerCase();
  const isSearching = q.length > 0;

  // Filtre local sur le jour (seulement si pas de recherche globale)
  const filtrées = useMemo(() => {
    if (isSearching) return [];
    return lignes;
  }, [lignes, isSearching]);

  // Résultats de recherche GLOBALE (tous les employés, indépendant du jour)
  const resultatsGlobaux = useMemo(() => {
    if (!isSearching) return [];
    return allEmployes
      .filter((e) => {
        // Mode simulation : on privilégie les employés de simulation si le flag existe
        if (mode === "simulation" && e.is_simulation === false) return false;
        if (mode === "normal" && e.is_simulation === true) return false;
        const nom = `${e.nom || ""} ${e.prenom || ""}`.toLowerCase();
        const mat = (e.matricule || "").toLowerCase();
        return nom.includes(q) || mat.includes(q);
      })
      .sort((a, b) =>
        `${a.nom || ""} ${a.prenom || ""}`
          .toLowerCase()
          .localeCompare(`${b.nom || ""} ${b.prenom || ""}`.toLowerCase())
      );
  }, [allEmployes, q, isSearching, mode]);

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
  }

  function goToday() {
    setJour(toISODate(new Date()));
  }

  function ouvrirParcours(emp) {
    // emp peut venir de l'historique jour (employe_id) ou de listeEmployes (id)
    const employeId = emp.employe_id ?? emp.id;
    setParcoursEmp({
      employe_id: employeId,
      nom: emp.nom,
      prenom: emp.prenom,
      matricule: emp.matricule,
      poste: emp.poste ?? (emp.id_poste ? posteMap[emp.id_poste] : null),
    });
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
        <button
          className="btn btn-ghost btn-sm"
          onClick={reload}
          disabled={loading || isSearching}
        >
          <Icon name="refresh" size={13} />
          Actualiser
        </button>
      </div>

      {/* Toggle Normal / Simulation */}
      <div className="flex gap-8" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          className={`btn btn-sm ${mode === "normal" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setMode("normal")}
        >
          Historique normal
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === "simulation" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setMode("simulation")}
        >
          Historique simulation
        </button>
      </div>

      {/* Recherche — indépendante du jour sélectionné */}
      <div className="panel" style={{ marginBottom: 16, padding: "12px 18px" }}>
        <input
          type="search"
          placeholder="Rechercher un nom ou matricule (tous les jours)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 420,
            fontFamily: "inherit",
            fontSize: 14,
            padding: "8px 12px",
			color: "#1a1a1a",
			backgroundColor: "#fff",
          }}
        />
        {isSearching && (
          <div className="mute" style={{ fontSize: 12, marginTop: 8 }}>
            Recherche sur tout le calendrier — le sélecteur de date est ignoré.
          </div>
        )}
      </div>

      {/* Sélecteur de date (masqué pendant une recherche globale) */}
      {!isSearching && (
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
                  if (e.target.value) setJour(e.target.value);
                }}
                style={{ fontFamily: "inherit", fontSize: 14, padding: "6px 10px", color: "#1a1a1a", backgroundColor: "#fff" }}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftJour(1)}>
                ›
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={goToday}>
                Aujourd&apos;hui
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

      {/* ========== RÉSULTATS DE RECHERCHE GLOBALE ========== */}
      {isSearching && (
        <section className="panel">
          <div className="panel-header">
            <h2>
              Résultats pour « {search.trim()} »
              <span className="mute" style={{ fontWeight: 400, marginLeft: 10, fontSize: 13 }}>
                {resultatsGlobaux.length} trouvé{resultatsGlobaux.length !== 1 ? "s" : ""}
              </span>
            </h2>
          </div>
          <div className="panel-body tight">
            {globalLoading && <div className="empty">Chargement…</div>}
            {!globalLoading && resultatsGlobaux.length === 0 && (
              <div className="empty">
                <strong>Aucun employé trouvé</strong>
                Aucun nom ni matricule ne correspond à « {search.trim()} ».
              </div>
            )}
            {resultatsGlobaux.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Matricule</th>
                      <th>Poste</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultatsGlobaux.map((e) => (
                      <tr
                        key={e.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => ouvrirParcours(e)}
                      >
                        <td>
                          <strong>
                            {e.nom} {e.prenom || ""}
                          </strong>
                        </td>
                        <td className="mono dim" style={{ fontSize: 12 }}>
                          {e.matricule}
                        </td>
                        <td>
                          {e.id_poste ? posteMap[e.id_poste] || `#${e.id_poste}` : (
                            <span className="mute">—</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              STATUT_BADGE[e.status] || "badge-mute"
                            }`}
                          >
                            {STATUT_LABEL[e.status] || e.status || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mute" style={{ fontSize: 12, marginTop: 12, padding: "0 4px 8px" }}>
              Clique sur un nom pour ouvrir son parcours (tous les jours).
            </div>
          </div>
        </section>
      )}

      {/* ========== LISTE DU JOUR (sans recherche) ========== */}
      {!isSearching && (
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
                {mode === "simulation"
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

      {parcoursEmp && (
        <ParcoursModal employe={parcoursEmp} onClose={() => setParcoursEmp(null)} />
      )}
    </div>
  );
}
