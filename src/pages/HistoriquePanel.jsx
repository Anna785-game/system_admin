import { api } from "../api/client";
import { useResource } from "../hooks/useResource";

function formatDT(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function HistoriquePanel() {
  const { data, loading, error } = useResource(api.historiqueCandidats, {
    refreshOn: ["vire_manuel", "retrait", "simulation_end"],
  });

  const historique = data || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Archives</div>
          <h1>Historique</h1>
        </div>
        <span className="badge badge-mute">{historique.length} passage{historique.length > 1 ? "s" : ""}</span>
      </div>

      <section className="panel">
        <div className="panel-body tight">
          {loading && <div className="empty">Chargement…</div>}
          {error && <div className="empty">{error}</div>}
          {!loading && historique.length === 0 && (
            <div className="empty">
              <strong>Historique vide</strong>
              Les candidats retirés ou virés apparaîtront ici.
            </div>
          )}
          {historique.length > 0 && (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr><th>Nom</th><th>Poste roulé</th><th>Inscrit à</th><th>Sorti à</th><th>Employé lié</th></tr>
                </thead>
                <tbody>
                  {historique.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nom}</td>
                      <td>{c.poste_attribue || <span className="mute">—</span>}</td>
                      <td className="mono dim">{formatDT(c.heure_inscription)}</td>
                      <td className="mono dim">{formatDT(c.heure_retrait)}</td>
                      <td className="mono dim">{c.employe_id ? `#${c.employe_id}` : "—"}</td>
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
