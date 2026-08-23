/**
 * Employés — liste simple (actifs / inactifs), sans drawer de parcours.
 * Le détail journalier (entrées / sorties / absences) vit désormais dans
 * Historique, filtré par date.
 *
 * Actions :
 *  - Virer  → status Inactif, carte détachée, biometrie nettoyée, marque
 *             "viré" pour aujourd'hui (reste visible dans Historique ce jour-là
 *             puis disparaît des jours suivants).
 *  - Supprimer → suppression définitive (hard delete).
 */

import { useMemo, useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";
import ParcoursModal from "../components/ParcoursModal";


async function fetchList() {
  const [employes, postes, cartes] = await Promise.all([
    api.listeEmployes(),
    api.listePostes(),
    api.listeCartes(),
  ]);
  return { employes, postes, cartes };
}

export default function EmployesPanel() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("Actif"); // Actif | Inactif | tous
  const [busy, setBusy] = useState(null);
  const [parcoursEmp, setParcoursEmp] = useState(null); // employé sélectionné pour le modal parcours

  const { data, loading, error, reload } = useResource(fetchList, {
    refreshOn: [
      "employe_actif",
      "poste_choisi",
      "vire_manuel",
      "simulation_end",
      "carte_assignee",
    ],
  });

  const employes = data?.employes || [];
  const postes = data?.postes || [];
  const cartes = data?.cartes || [];
  const posteMap = useMemo(
    () => Object.fromEntries(postes.map((p) => [p.id, p.type_poste])),
    [postes]
  );
  // carterfid_id -> "UID (couleur)", pour afficher la carte attribuée à
  // chaque employé sans changer le schéma EmployeOut côté backend.
  const carteMap = useMemo(
    () =>
      Object.fromEntries(
        cartes.map((c) => [
          c.id,
          c.couleur ? `${c.uidcarte} (${c.couleur})` : c.uidcarte,
        ])
      ),
    [cartes]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employes.filter((e) => {
      if (filtreStatut !== "tous" && (e.status || "Actif") !== filtreStatut) {
        return false;
      }
      if (!q) return true;
      const nom = `${e.nom || ""} ${e.prenom || ""}`.toLowerCase();
      return (
        nom.includes(q) || (e.matricule || "").toLowerCase().includes(q)
      );
    });
  }, [employes, search, filtreStatut]);

  async function virer(e) {
    const nom = `${e.nom || ""} ${e.prenom || ""}`.trim() || e.matricule;
    if (
      !window.confirm(
        `Virer ${nom} ?\nIl passera Inactif aujourd'hui, disparaîtra de la liste active, et restera visible dans Historique uniquement pour les jours où il a travaillé (ou le jour du licenciement). Sa carte RFID sera libérée.`
      )
    ) {
      return;
    }
    setBusy(e.id);
    try {
      await api.virerEmploye(e.id);
      toast.success(`${nom} a été viré. Sa carte est de nouveau disponible.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function supprimer(e) {
    const nom = `${e.nom || ""} ${e.prenom || ""}`.trim() || e.matricule;
    if (
      !window.confirm(
        `Supprimer définitivement ${nom} ?\nToutes ses données (présences, absences) seront perdues. Préférez « Virer » pour conserver l'historique.`
      )
    ) {
      return;
    }
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

  function ouvrirParcours(e) {
    setParcoursEmp({
      employe_id: e.id,
      nom: e.nom,
      prenom: e.prenom,
      matricule: e.matricule,
      poste: e.id_poste ? posteMap[e.id_poste] : null,
    });
  }

  const nbActifs = employes.filter((e) => e.status === "Actif").length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Effectif</div>
          <h1>Employés</h1>
        </div>
        <span className={`badge ${nbActifs > 0 ? "badge-green" : "badge-mute"}`}>
          {nbActifs} actif{nbActifs !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        className="flex gap-8"
        style={{ marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}
      >
        <div className="field" style={{ width: 240, margin: 0 }}>
          <input
            type="search"
            placeholder="Rechercher nom, matricule…"
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
          />
        </div>
        <div className="flex gap-8" style={{ alignItems: "center" }}>
          {["Actif", "Inactif", "tous"].map((s) => (
            <button
              key={s}
              type="button"
              className={`btn btn-sm ${filtreStatut === s ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFiltreStatut(s)}
            >
              {s === "tous" ? "Tous" : s}
            </button>
          ))}
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
              {search || filtreStatut !== "tous"
                ? "Aucun résultat pour ce filtre."
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
                    <th>Carte attribuée</th>
                    <th>Statut</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => ouvrirParcours(e)}
                      title="Voir le parcours détaillé"
                    >
                      <td>
                        <strong>
                          {e.nom} {e.prenom || ""}
                        </strong>
                      </td>
                      <td className="mono">{e.matricule}</td>
                      <td>
                        {e.id_poste ? (
                          posteMap[e.id_poste] || "—"
                        ) : (
                          <span className="mute">—</span>
                        )}
                      </td>
                      <td className="mono">
                        {e.carterfid_id ? (
                          carteMap[e.carterfid_id] || (
                            <span className="mute">carte #{e.carterfid_id}</span>
                          )
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
                      <td
                        style={{ textAlign: "right", whiteSpace: "nowrap" }}
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        {e.status === "Actif" && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => virer(e)}
                            disabled={busy === e.id}
                            title="Virer (passe Inactif, garde l'historique)"
                          >
                            {busy === e.id ? (
                              <span className="spinner" />
                            ) : (
                              <Icon name="logout" size={13} />
                            )}
                            Virer
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => supprimer(e)}
                          disabled={busy === e.id}
                          title="Supprimer définitivement"
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

      <p className="mute" style={{ fontSize: 12.5, marginTop: 12 }}>
        Clique sur un employé pour voir son parcours détaillé (graphes,
        présences, absences, journal complet).
      </p>

      {parcoursEmp && (
        <ParcoursModal employe={parcoursEmp} onClose={() => setParcoursEmp(null)} />
      )}
    </div>
  );
}
