import { useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";

export default function CartesPanel() {
  const { data, loading, error, reload } = useResource(api.listeCartes, {
    refreshOn: ["carte_assignee", "entree_entreprise", "sortie_entreprise"],
  });
  const toast = useToast();
  const [uid, setUid] = useState("");
  const [couleur, setCouleur] = useState("");
  const [busy, setBusy] = useState(false);

  const cartes = data || [];

  async function creer(e) {
    e.preventDefault();
    if (!uid.trim()) return;
    setBusy(true);
    try {
      await api.creerCarte({ uidcarte: uid.trim(), couleur: couleur.trim() || null });
      toast.success(`Carte ${uid} créée.`);
      setUid("");
      setCouleur("");
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function supprimer(c) {
    if (!window.confirm(`Supprimer la carte ${c.uidcarte} ?`)) return;
    setBusy(true);
    try {
      await api.supprimerCarte(c.id);
      toast.success("Carte supprimée.");
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Badges physiques</div>
          <h1>Cartes RFID</h1>
        </div>
        <span className="badge badge-mute">{cartes.length} carte{cartes.length > 1 ? "s" : ""}</span>
      </div>

      <section className="panel">
        <div className="panel-body tight">
          {loading && <div className="empty">Chargement…</div>}
          {error && <div className="empty">{error}</div>}
          {!loading && cartes.length === 0 && (
            <div className="empty">
              <strong>Aucune carte enregistrée</strong>
              Ajoute l'UID de chaque badge RFID physique disponible pour l'expo.
            </div>
          )}
          {cartes.length > 0 && (
            <table className="table">
              <thead><tr><th>UID</th><th>Couleur</th><th>Présent dans l'entreprise</th><th /></tr></thead>
              <tbody>
                {cartes.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.uidcarte}</td>
                    <td>{c.couleur || <span className="mute">—</span>}</td>
                    <td>
                      <span className={`badge ${c.isentree ? "badge-green" : "badge-mute"}`}>
                        {c.isentree ? "Dedans" : "Dehors"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => supprimer(c)} disabled={busy}>
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form onSubmit={creer} className="inline-form">
            <div className="field" style={{ flex: 2 }}>
              <label htmlFor="carte-uid">UID de la carte</label>
              <input id="carte-uid" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="ex. 04:A3:F1:9C" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="carte-couleur">Couleur (optionnel)</label>
              <input id="carte-couleur" value={couleur} onChange={(e) => setCouleur(e.target.value)} placeholder="ex. noire" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              <Icon name="plus" size={14} /> Ajouter
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
