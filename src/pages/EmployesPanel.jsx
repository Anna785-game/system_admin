import { useMemo, useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";

function formatDuree(min) {
  if (min === null || min === undefined) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

async function fetchMeta() {
  const [employes, postes] = await Promise.all([api.listeEmployes(), api.listePostes()]);
  return { employes, postes };
}

export default function PresencesPanel() {
  const [jour, setJour] = useState("");
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  // Table de correspondance id_employe -> employé / poste, comme dans EmployesPanel.
  const { data: meta } = useResource(fetchMeta, {
    refreshOn: ["employe_actif", "roulette", "vire_manuel"],
  });
  const employeMap = useMemo(
    () => Object.fromEntries((meta?.employes || []).map((e) => [e.id, e])),
    [meta]
  );
  const posteMap = useMemo(
    () => Object.fromEntries((meta?.postes || []).map((p) => [p.id, p.type_poste])),
    [meta]
  );

  function nomEmploye(id) {
    const e = employeMap[id];
    return e ? `${e.nom} ${e.prenom || ""}`.trim() : `#${id}`;
  }
  function posteEmploye(id) {
    const e = employeMap[id];
    if (!e?.id_poste) return <span className="mute">—</span>;
    return posteMap[e.id_poste] || `#${e.id_poste}`;
  }

  const { data: presences, loading: loadingP, error: errorP, reload: reloadP } = useResource(
    () => api.listePresences(jour ? { jour } : {}),
    { refreshOn: ["entree_entreprise", "sortie_entreprise", "simulation_day"], deps: [jour] },
  );
  const { data: absences, loading: loadingA, reload: reloadA } = useResource(api.listeAbsences, {
    refreshOn: ["simulation_day", "simulation_end"],
  });

  async function runJob(fn, label) {
    setBusy(label);
    try {
      const res = await fn();
      toast.success(res?.message || `${label} exécuté.`);
      reloadP();
      reloadA();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Pointage</div>
          <h1>Présences &amp; absences</h1>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-sm" onClick={() => runJob(api.jobCalculDuree, "Calcul des durées")} disabled={!!busy}>
            {busy === "Calcul des durées" ? <span className="spinner" /> : <Icon name="clock" size={13} />}
            Calculer les durées du jour
          </button>
          <button className="btn btn-sm" onClick={() => runJob(api.jobInsertAbsences, "Insertion des absences")} disabled={!!busy}>
            {busy === "Insertion des absences" ? <span className="spinner" /> : <Icon name="bolt" size={13} />}
            Marquer les absents du jour
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Présences</h2>
          <div className="field" style={{ width: 180 }}>
            <input type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
          </div>
        </div>
        <div className="panel-body tight">
          {loadingP && <div className="empty">Chargement…</div>}
          {errorP && <div className="empty">{errorP}</div>}
          {!loadingP && (presences || []).length === 0 && (
            <div className="empty">
              <strong>Aucune présence</strong>
              {jour ? "Aucun enregistrement pour cette date." : "Les entrées/sorties badgées apparaîtront ici."}
            </div>
          )}
          {(presences || []).length > 0 && (
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Employé</th><th>Poste</th><th>Date</th><th>Statut</th><th>Durée</th></tr></thead>
                <tbody>
                  {presences.map((p) => (
                    <tr key={p.id}>
                      <td>{nomEmploye(p.id_employe)} <span className="mono dim">#{p.id_employe}</span></td>
                      <td>{posteEmploye(p.id_employe)}</td>
                      <td className="mono dim">{p.datedujour}</td>
                      <td><span className="badge badge-green">{p.statut || "—"}</span></td>
                      <td className="mono">{formatDuree(p.dureetravail)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>Absences</h2></div>
        <div className="panel-body tight">
          {loadingA && <div className="empty">Chargement…</div>}
          {!loadingA && (absences || []).length === 0 && (
            <div className="empty">
              <strong>Aucune absence enregistrée</strong>
              Utilise "Marquer les absents du jour" pour générer les absences du jour.
            </div>
          )}
          {(absences || []).length > 0 && (
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Employé</th><th>Poste</th><th>Date</th><th>Raison</th></tr></thead>
                <tbody>
                  {absences.map((a) => (
                    <tr key={a.id}>
                      <td>{nomEmploye(a.idemploye)} <span className="mono dim">#{a.idemploye}</span></td>
                      <td>{posteEmploye(a.idemploye)}</td>
                      <td className="mono dim">{a.dateabsence}</td>
                      <td>{a.raison || <span className="mute">Non justifiée</span>}</td>
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