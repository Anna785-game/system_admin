import { useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";

function formatHeure(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

async function fetchData() {
  const [candidats, stats] = await Promise.all([
    api.listeCandidats(),
    api.statsCandidats(),
  ]);
  return { candidats, stats };
}

export default function CandidatsPanel() {
  const { data, loading, error, reload } = useResource(fetchData, {
    refreshOn: [
      "inscription",
      "candidat_actif",
      "retrait",
      "vire_manuel",
      "employe_actif",
      "poste_choisi",
      "carte_assignee",
      // La capacité (candidats actifs autorisés) suit le nombre de cartes
      // RFID en base : on se rafraîchit dès qu'une carte apparaît/disparaît.
      "carte_enregistree",
      "carte_creee",
      "carte_supprimee",
    ],
  });
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  const candidats = data?.candidats || [];
  const attente = candidats.filter((c) => c.statut === "attente");
  const actifs = candidats.filter((c) => c.statut === "actif");
  // Capacité dynamique : autant de candidats actifs que de cartes RFID
  // enregistrées (scannées au portillon ou ajoutées dans le panneau Cartes).
  const maxActifs = data?.stats?.max_actifs ?? 0;
  const peutAccepter = maxActifs > 0 && actifs.length < maxActifs;

  async function run(id, fn, msgOk) {
    setBusyId(id);
    try {
      await fn();
      toast.success(msgOk);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function accepter(c) {
    if (!peutAccepter) {
      return toast.error(
        maxActifs === 0
          ? "Aucune carte RFID enregistrée. Scannez-en une avant d'accepter un candidat."
          : `Déjà ${maxActifs} candidat${maxActifs !== 1 ? "s" : ""} actif${maxActifs !== 1 ? "s" : ""} (autant que de cartes RFID) — retire-en un d'abord.`
      );
    }
    run(c.id, () => api.accepterCandidat(c.id), `${c.nom} appelé à l'enregistrement.`);
  }

  async function supprimer(c) {
    if (!window.confirm(`Supprimer définitivement ${c.nom} de la file ?`)) return;
    run(c.id, () => api.supprimerCandidat(c.id), `${c.nom} supprimé.`);
  }

  async function retirer(c) {
    run(c.id, () => api.retirerCandidat(c.id), `${c.nom} retiré du poste actif.`);
  }

  async function virer(c) {
    if (
      !window.confirm(
        `Virer ${c.nom} maintenant ? Cette action désactive son badge et son visage.`
      )
    )
      return;
    run(c.id, () => api.virerCandidat(c.id), `${c.nom} viré.`);
  }

  async function viderAttente() {
    if (!window.confirm("Archiver toute la file d'attente vers l'historique ?")) return;
    run("all", () => api.viderAttente(), "File d'attente vidée.");
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Parcours candidat</div>
          <h1>Candidats</h1>
        </div>
        <button
          className="btn btn-danger"
          onClick={viderAttente}
          disabled={busyId === "all" || attente.length === 0}
        >
          <Icon name="trash" size={14} />
          Vider la file d&apos;attente
        </button>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-header">
            <h2>Postes actifs</h2>
            <span className={`badge ${actifs.length > 0 ? "badge-green" : "badge-mute"}`}>
              {actifs.length}/{maxActifs}
            </span>
          </div>
          <div className="panel-body">
            {loading && !data && <div className="empty">Chargement…</div>}
            {!loading && maxActifs === 0 && (
              <div className="empty">
                <strong>Aucune carte RFID enregistrée</strong>
                Scannez une carte au portillon, ou ajoutez-en une dans le
                panneau Cartes, pour pouvoir accepter des candidats. La
                capacité suit automatiquement le nombre de cartes en base.
              </div>
            )}
            {!loading && maxActifs > 0 && actifs.length === 0 && (
              <div className="empty">
                <strong>Aucun candidat actif</strong>
                Accepte jusqu&apos;à {maxActifs} personne{maxActifs !== 1 ? "s" : ""} depuis la
                file d&apos;attente ({maxActifs} carte{maxActifs !== 1 ? "s" : ""} RFID enregistrée{maxActifs !== 1 ? "s" : ""}).
              </div>
            )}
            {actifs.map((actif) => (
              <div key={actif.id} className="active-card" style={{ marginBottom: 12 }}>
                <div className="active-card-name">{actif.nom}</div>
                <div className="dim" style={{ fontSize: 12.5, marginBottom: 14 }}>
                  Accepté à {formatHeure(actif.heure_acceptation)}
                  {actif.poste_attribue ? (
                    <>
                      {" "}
                      · poste choisi : <strong>{actif.poste_attribue}</strong>
                    </>
                  ) : (
                    <> · en attente d&apos;enrôlement visage / choix du poste</>
                  )}
                </div>
                <div className="flex gap-8">
                  <button
                    className="btn btn-sm"
                    onClick={() => retirer(actif)}
                    disabled={busyId === actif.id}
                  >
                    Retirer
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => virer(actif)}
                    disabled={busyId === actif.id}
                  >
                    Virer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>File d&apos;attente</h2>
            <span className="badge badge-mute">{attente.length}</span>
          </div>
          <div className="panel-body tight">
            {loading && <div className="empty">Chargement…</div>}
            {error && <div className="empty">{error}</div>}
            {!loading && attente.length === 0 && (
              <div className="empty">
                <strong>File vide</strong>
                Les inscriptions faites depuis le front visiteur apparaîtront ici.
              </div>
            )}
            {attente.length > 0 && (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Inscrit à</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {attente.map((c) => (
                      <tr key={c.id}>
                        <td>{c.nom}</td>
                        <td className="mono dim">{formatHeure(c.heure_inscription)}</td>
                        <td>
                          <div
                            className="flex gap-8"
                            style={{ justifyContent: "flex-end" }}
                          >
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => accepter(c)}
                              disabled={busyId === c.id || !peutAccepter}
                              title={
                                !peutAccepter
                                  ? maxActifs === 0
                                    ? "Aucune carte RFID enregistrée"
                                    : `Maximum ${maxActifs} actifs (autant que de cartes RFID)`
                                  : undefined
                              }
                            >
                              Accepter
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => supprimer(c)}
                              disabled={busyId === c.id}
                            >
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
    </div>
  );
}
