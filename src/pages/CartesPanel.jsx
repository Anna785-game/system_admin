import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useToast } from "../context/ToastContext";
import { useWs } from "../context/WsContext";
import Icon from "../components/Icon";

export default function CartesPanel() {
  const { data, loading, error, reload } = useResource(api.listeCartes, {
    refreshOn: [
      "carte_assignee",
      "carte_enregistree",
      "carte_creee",
      "carte_supprimee",
      "carte_libre_scannee",
      "entree_entreprise",
      "sortie_entreprise",
    ],
  });
  const {
    data: attente,
    loading: loadingAttente,
    reload: reloadAttente,
  } = useResource(api.listeCartesEnAttente, {
    refreshOn: [
      "poste_choisi",
      "carte_assignee",
      "employe_actif",
      "vire_manuel",
      "retrait",
    ],
  });
  const {
    data: dispo,
    reload: reloadDispo,
  } = useResource(api.listeCartesDisponibles, {
    refreshOn: ["carte_assignee", "carte_enregistree"],
  });

  const toast = useToast();
  const { subscribe } = useWs();
  const [uid, setUid] = useState("");
  const [couleur, setCouleur] = useState("");
  const [busy, setBusy] = useState(false);
  // employe_id -> carterfid_id sélectionné dans le select
  const [choix, setChoix] = useState({});

  const cartes = data || [];
  const enAttente = attente || [];
  const disponibles = dispo || [];

  // Notif live quand l'ESP32 enregistre / rescane une carte libre
  useEffect(() => {
    return subscribe(["carte_enregistree", "carte_libre_scannee"], (ev) => {
      if (ev.event === "carte_enregistree") {
        toast.success(
          ev.message || `Nouvelle carte ${ev.carte_uid} enregistrée (libre).`
        );
      } else {
        toast.info(
          ev.message || `Carte libre scannée : ${ev.carte_uid}`
        );
      }
      reload();
      reloadDispo();
    });
  }, [subscribe, toast, reload, reloadDispo]);

  async function creer(e) {
    e.preventDefault();
    if (!uid.trim()) return;
    setBusy(true);
    try {
      await api.creerCarte({
        uidcarte: uid.trim(),
        couleur: couleur.trim() || null,
      });
      toast.success(`Carte ${uid} créée.`);
      setUid("");
      setCouleur("");
      reload();
      reloadDispo();
    } catch (err) {
      toast.error(err.message);
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
      reloadDispo();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function attribuer(employeId) {
    const carterfidId = choix[employeId];
    if (!carterfidId) {
      toast.error("Choisis d'abord une carte disponible.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.attribuerCarte(employeId, Number(carterfidId));
      toast.success(
        `Carte ${res.carte_uid} remise à ${res.nom}. Donne-lui la carte physique.`
      );
      setChoix((prev) => {
        const next = { ...prev };
        delete next[employeId];
        return next;
      });
      reload();
      reloadAttente();
      reloadDispo();
    } catch (err) {
      toast.error(err.message);
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
        <span className="badge badge-mute">
          {cartes.length} carte{cartes.length > 1 ? "s" : ""}
        </span>
      </div>

      <p className="mute" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 16 }}>
        Le nombre de cartes ci-dessous détermine la capacité de candidats
        actifs en parallèle (panneau Candidats) : ajouter une carte
        l&apos;augmente, en supprimer une la diminue.
      </p>

      {/* ---- En attente de carte ---- */}
      <section className="panel">
        <div className="panel-header">
          <h2>En attente de carte</h2>
          <span
            className={`badge ${enAttente.length > 0 ? "badge-yellow" : "badge-mute"}`}
          >
            {enAttente.length}
          </span>
        </div>
        <div className="panel-body tight">
          {loadingAttente && !attente && (
            <div className="empty">Chargement…</div>
          )}
          {!loadingAttente && enAttente.length === 0 && (
            <div className="empty">
              <strong>Personne n&apos;attend de carte</strong>
              Les candidats apparaissent ici une fois le visage enrôlé et le
              poste choisi depuis leur téléphone. Tu leur remets alors une
              carte physique.
            </div>
          )}
          {enAttente.length > 0 && (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Poste</th>
                    <th>Matricule</th>
                    <th>Carte à remettre</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {enAttente.map((row) => (
                    <tr key={row.employe_id}>
                      <td>
                        <strong>{row.nom}</strong>
                      </td>
                      <td>
                        {row.poste || <span className="mute">—</span>}
                      </td>
                      <td className="mono dim">{row.matricule}</td>
                      <td>
                        <select
                          value={choix[row.employe_id] || ""}
                          onChange={(e) =>
                            setChoix((prev) => ({
                              ...prev,
                              [row.employe_id]: e.target.value,
                            }))
                          }
                          disabled={busy || disponibles.length === 0}
                          style={{ minWidth: 140 }}
                        >
                          <option value="">
                            {disponibles.length === 0
                              ? "Aucune carte libre"
                              : "Choisir une carte…"}
                          </option>
                          {disponibles.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.uidcarte}
                              {c.couleur ? ` (${c.couleur})` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => attribuer(row.employe_id)}
                          disabled={busy || !choix[row.employe_id]}
                        >
                          Attribuer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {disponibles.length === 0 && enAttente.length > 0 && (
            <div className="mute" style={{ fontSize: 12.5, marginTop: 10 }}>
              Aucune carte libre : badge une carte vierge sur la porte (elle
              s&apos;enregistre toute seule), ou ajoute un UID ci-dessous.
            </div>
          )}
        </div>
      </section>

      {/* ---- Toutes les cartes ---- */}
      <section className="panel">
        <div className="panel-header">
          <h2>Toutes les cartes</h2>
        </div>
        <div className="panel-body tight">
          {loading && <div className="empty">Chargement…</div>}
          {error && <div className="empty">{error}</div>}
          {!loading && cartes.length === 0 && (
            <div className="empty">
              <strong>Aucune carte enregistrée</strong>
              Badge une carte vierge sur le lecteur de porte pour
              l&apos;enregistrer automatiquement, ou saisis un UID
              manuellement ci-dessous.
            </div>
          )}
          {cartes.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Couleur</th>
                  <th>Présent dans l&apos;entreprise</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cartes.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.uidcarte}</td>
                    <td>
                      {c.couleur || <span className="mute">—</span>}
                    </td>
                    <td>
                      <span
                        className={`badge ${c.isentree ? "badge-green" : "badge-mute"}`}
                      >
                        {c.isentree ? "Dedans" : "Dehors"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => supprimer(c)}
                        disabled={busy}
                      >
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
              <label htmlFor="carte-uid">UID de la carte (manuel)</label>
              <input
                id="carte-uid"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder="ex. 04A3F19C (ou badge sur la porte)"
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="carte-couleur">Couleur (optionnel)</label>
              <input
                id="carte-couleur"
                value={couleur}
                onChange={(e) => setCouleur(e.target.value)}
                placeholder="ex. noire"
              />
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
