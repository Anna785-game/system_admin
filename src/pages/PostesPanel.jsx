import { useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";

export default function PostesPanel() {
  const { data, loading, error, reload } = useResource(api.listePostes, { refreshOn: ["poste_choisi"] });
  const toast = useToast();
  const [nom, setNom] = useState("");
  const [busy, setBusy] = useState(false);

  const postes = data || [];

  async function seed() {
    setBusy(true);
    try {
      const created = await api.seedPostesDemo();
      toast.success(created.length ? `${created.length} poste(s) créé(s).` : "Postes déjà en place.");
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function creer(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    setBusy(true);
    try {
      await api.creerPoste({ type_poste: nom.trim() });
      toast.success(`Poste "${nom}" créé.`);
      setNom("");
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function supprimer(p) {
    if (!window.confirm(`Supprimer le poste "${p.type_poste}" ?`)) return;
    setBusy(true);
    try {
      await api.supprimerPoste(p.id);
      toast.success("Poste supprimé.");
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
          <div className="eyebrow">Back-office</div>
          <h1>Postes</h1>
        </div>
        <button className="btn" onClick={seed} disabled={busy}>
          <Icon name="dial" size={14} />
          Seed démo (Vendeur / Nettoyeur / Boss)
        </button>
      </div>

      <div className="mute" style={{ fontSize: 12.5, marginBottom: 16 }}>
        Ces postes sont proposés au candidat depuis son téléphone, une fois son
        visage enrôlé : c'est lui qui choisit son poste dans cette liste, il
        n'y a plus de tirage au sort.
      </div>

      <section className="panel">
        <div className="panel-header"><h2>Postes configurés</h2></div>
        <div className="panel-body tight">
          {loading && <div className="empty">Chargement…</div>}
          {!loading && postes.length === 0 && (
            <div className="empty">
              <strong>Aucun poste configuré</strong>
              Utilise le seed démo ou crée-en un manuellement — sinon le candidat n'aura rien à choisir sur son téléphone.
            </div>
          )}
          {postes.length > 0 && (
            <table className="table">
              <thead><tr><th>Poste</th><th /></tr></thead>
              <tbody>
                {postes.map((p) => (
                  <tr key={p.id}>
                    <td>{p.type_poste}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => supprimer(p)} disabled={busy}>
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
              <label htmlFor="poste-nom">Nom du poste</label>
              <input id="poste-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Stagiaire café" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              <Icon name="plus" size={14} /> Ajouter
            </button>
          </form>
        </div>
      </section>
      {error && <div className="empty">{error}</div>}
    </div>
  );
}
