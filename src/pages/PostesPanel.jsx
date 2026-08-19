import { useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useToast } from "../context/ToastContext";
import { posteInfo, toneHex } from "../constants/postes";
import Icon from "../components/Icon";

export default function PostesPanel() {
  const { data, loading, error, reload } = useResource(api.listePostes, { refreshOn: ["roulette"] });
  const toast = useToast();
  const [nom, setNom] = useState("");
  const [poids, setPoids] = useState(30);
  const [busy, setBusy] = useState(false);

  const postes = data || [];
  const total = postes.reduce((s, p) => s + (p.poids || 1), 0) || 1;

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
      await api.creerPoste({ type_poste: nom.trim(), poids: Number(poids) || 1 });
      toast.success(`Poste "${nom}" créé.`);
      setNom("");
      setPoids(30);
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
          <div className="eyebrow">Roue des postes</div>
          <h1>Postes &amp; probabilités</h1>
        </div>
        <button className="btn" onClick={seed} disabled={busy}>
          <Icon name="dial" size={14} />
          Seed démo (Vendeur / Nettoyeur / Boss)
        </button>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-header"><h2>Répartition actuelle</h2></div>
          <div className="panel-body">
            {loading && <div className="empty">Chargement…</div>}
            {!loading && postes.length === 0 && (
              <div className="empty">
                <strong>Aucun poste configuré</strong>
                Utilise le seed démo ou crée-en un manuellement — sinon la roulette du visage échouera.
              </div>
            )}
            <div className="odds-bars">
              {postes.map((p) => {
                const info = posteInfo(p.type_poste);
                const hex = toneHex(info.tone);
                const pct = Math.round(((p.poids || 1) / total) * 1000) / 10;
                return (
                  <div key={p.id} className="odds-bar-row">
                    <div className="odds-bar-label">
                      <span>{info.icon} {p.type_poste}</span>
                      <span className="mono dim">{pct}%</span>
                    </div>
                    <div className="odds-bar-track">
                      <div className="odds-bar-fill" style={{ width: `${pct}%`, background: hex.solid }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><h2>Postes configurés</h2></div>
          <div className="panel-body tight">
            {postes.length > 0 && (
              <table className="table">
                <thead><tr><th>Poste</th><th>Poids</th><th /></tr></thead>
                <tbody>
                  {postes.map((p) => (
                    <tr key={p.id}>
                      <td>{p.type_poste}</td>
                      <td className="mono dim">{p.poids}</td>
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
              <div className="field" style={{ width: 100 }}>
                <label htmlFor="poste-poids">Poids</label>
                <input id="poste-poids" type="number" min="1" value={poids} onChange={(e) => setPoids(e.target.value)} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                <Icon name="plus" size={14} /> Ajouter
              </button>
            </form>
          </div>
        </section>
      </div>
      {error && <div className="empty">{error}</div>}
    </div>
  );
}
