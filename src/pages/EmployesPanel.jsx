import { useMemo, useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";

async function fetchAll() {
  const [employes, postes, cartes] = await Promise.all([
    api.listeEmployes(),
    api.listePostes(),
    api.listeCartes(),
  ]);
  return { employes, postes, cartes };
}

export default function EmployesPanel() {
  const { data, loading, error, reload } = useResource(fetchAll, {
    refreshOn: ["employe_actif", "roulette", "vire_manuel", "carte_assignee", "simulation_end"],
  });
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("tous");

  const posteMap = useMemo(() => Object.fromEntries((data?.postes || []).map((p) => [p.id, p.type_poste])), [data]);
  const carteMap = useMemo(() => Object.fromEntries((data?.cartes || []).map((c) => [c.id, c.uidcarte])), [data]);
  const cartesLibres = useMemo(() => (data?.cartes || []).filter((c) => !(data?.employes || []).some((e) => e.carterfid_id === c.id)), [data]);

  const employes = (data?.employes || []).filter((e) => filter === "tous" || e.status === filter);

  async function toggleStatus(emp) {
    setBusyId(emp.id);
    try {
      const next = emp.status === "Actif" ? "Inactif" : "Actif";
      await api.updateEmploye(emp.id, { status: next });
      toast.success(`${emp.nom} passé ${next.toLowerCase()}.`);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function assignerCarte(emp, carteId) {
    if (!carteId) return;
    setBusyId(emp.id);
    try {
      await api.updateEmploye(emp.id, { carterfid_id: Number(carteId) });
      toast.success(`Carte assignée à ${emp.nom}.`);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function supprimerVisage(emp) {
    if (!window.confirm(`Supprimer l'encoding facial de ${emp.nom} ?`)) return;
    setBusyId(emp.id);
    try {
      await api.supprimerVisage(emp.id);
      toast.success("Encoding facial supprimé.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function supprimer(emp) {
    if (!window.confirm(`Supprimer définitivement l'employé ${emp.nom} ? Action irréversible.`)) return;
    setBusyId(emp.id);
    try {
      await api.supprimerEmploye(emp.id);
      toast.success(`${emp.nom} supprimé.`);
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
          <div className="eyebrow">Registre du personnel</div>
          <h1>Employés</h1>
        </div>
        <div className="segmented">
          {["tous", "Actif", "Inactif"].map((f) => (
            <button key={f} className={`segmented-item ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "tous" ? "Tous" : f}
            </button>
          ))}
        </div>
      </div>

      <section className="panel">
        <div className="panel-body tight">
          {loading && <div className="empty">Chargement…</div>}
          {error && <div className="empty">{error}</div>}
          {!loading && employes.length === 0 && (
            <div className="empty">
              <strong>Aucun employé</strong>
              Les candidats acceptés apparaîtront ici une fois promus.
            </div>
          )}
          {employes.length > 0 && (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Nom</th>
                    <th>Poste</th>
                    <th>Statut</th>
                    <th>Carte RFID</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employes.map((e) => (
                    <tr key={e.id} className={e.status !== "Actif" ? "row-fade" : ""}>
                      <td className="mono dim">{e.matricule}</td>
                      <td>{e.nom} {e.prenom || ""}</td>
                      <td>{e.id_poste ? posteMap[e.id_poste] || `#${e.id_poste}` : <span className="mute">— pas encore roulé</span>}</td>
                      <td>
                        <span className={`badge ${e.status === "Actif" ? "badge-green" : "badge-red"}`}>{e.status}</span>
                      </td>
                      <td>
                        {e.carterfid_id ? (
                          <span className="mono">{carteMap[e.carterfid_id] || `#${e.carterfid_id}`}</span>
                        ) : cartesLibres.length > 0 ? (
                          <select
                            className="mini-select"
                            defaultValue=""
                            onChange={(ev) => assignerCarte(e, ev.target.value)}
                            disabled={busyId === e.id}
                          >
                            <option value="" disabled>Assigner…</option>
                            {cartesLibres.map((c) => (
                              <option key={c.id} value={c.id}>{c.uidcarte}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="mute">aucune libre</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-8" style={{ justifyContent: "flex-end" }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(e)} disabled={busyId === e.id}>
                            {e.status === "Actif" ? "Désactiver" : "Réactiver"}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => supprimerVisage(e)} disabled={busyId === e.id} title="Supprimer l'encoding facial">
                            Visage
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => supprimer(e)} disabled={busyId === e.id}>
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
