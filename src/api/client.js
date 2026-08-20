// Client REST pour l'API FastAPI (fastapi_pointage, voir v.txt).
// Toutes les routes protégées attendent un JWT Supabase dans
// `Authorization: Bearer <token>`, posé par AuthContext.

export const API_BASE = import.meta.env.VITE_API_BASE || "https://presence-1s80.onrender.com";

let getToken = () => null;
// Injecté par AuthContext au démarrage pour que le client puisse toujours
// lire le token courant sans dépendre d'un import circulaire.
export function bindTokenGetter(fn) {
  getToken = fn;
}

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, { method = "GET", body, headers, isForm = false } = {}) {
  const token = getToken();
  const finalHeaders = { ...(headers || {}) };
  if (!isForm) finalHeaders["Content-Type"] = "application/json";
  if (token) finalHeaders["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (e) {
    throw new ApiError("Impossible de joindre le serveur API.", 0, null);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const detail = (data && data.detail) || `Erreur ${res.status}`;
    throw new ApiError(typeof detail === "string" ? detail : JSON.stringify(detail), res.status, data);
  }
  return data;
}

export const api = {
  // ---- auth --------------------------------------------------------
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),

  // ---- candidats -----------------------------------------------------
  listeCandidats: () => request("/candidats"),
  historiqueCandidats: () => request("/candidats/historique"),
  statsCandidats: () => request("/candidats/stats"),
  accepterCandidat: (id) => request(`/candidats/${id}/accepter`, { method: "POST" }),
  retirerCandidat: (id) => request(`/candidats/${id}/retirer`, { method: "POST" }),
  virerCandidat: (id) => request(`/candidats/${id}/virer`, { method: "POST" }),
  supprimerCandidat: (id) => request(`/candidats/${id}`, { method: "DELETE" }),
  viderAttente: () => request("/candidats/vider-attente", { method: "POST" }),
  supprimerToutAttente: () => request("/candidats/attente/tout", { method: "DELETE" }),

  // ---- employés --------------------------------------------------------
  listeEmployes: () => request("/employes"),
  getEmploye: (id) => request(`/employes/${id}`),
  updateEmploye: (id, payload) => request(`/employes/${id}`, { method: "PATCH", body: payload }),
  supprimerEmploye: (id) => request(`/employes/${id}`, { method: "DELETE" }),

  // ---- postes --------------------------------------------------------
  listePostes: () => request("/postes"),
  creerPoste: (payload) => request("/postes", { method: "POST", body: payload }),
  supprimerPoste: (id) => request(`/postes/${id}`, { method: "DELETE" }),
  seedPostesDemo: () => request("/postes/seed-demo", { method: "POST" }),

  // ---- cartes RFID --------------------------------------------------
  listeCartes: () => request("/cartes"),
  creerCarte: (payload) => request("/cartes", { method: "POST", body: payload }),
  supprimerCarte: (id) => request(`/cartes/${id}`, { method: "DELETE" }),
  listeCartesEnAttente: () => request("/cartes/en-attente"),
  listeCartesDisponibles: () => request("/cartes/disponibles"),
  attribuerCarte: (employeId, carterfidId) =>
    request("/cartes/attribuer", {
      method: "POST",
      body: { employe_id: employeId, carterfid_id: carterfidId },
    }),

  // ---- historique journalier ------------------------------------------
  historiqueJour: (dateISO) =>
    request(`/historique/jour?date=${encodeURIComponent(dateISO)}`),

  // ---- virer un employé (depuis le panneau Employés) -------------------
  virerEmploye: (id) =>
    request(`/employes/${id}/virer`, { method: "POST" }),

  // ---- présences / absences -----------------------------------------
  listePresences: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/presences${qs ? `?${qs}` : ""}`);
  },
  listeAbsences: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/absences${qs ? `?${qs}` : ""}`);
  },

  // ---- jobs planifiés --------------------------------------------------
  jobCalculDuree: () => request("/jobs/calcul-duree-travail", { method: "POST" }),
  jobInsertAbsences: () => request("/jobs/insert-absences", { method: "POST" }),

  // ---- pointage / badge -----------------------------------------------
  scanSimulation: (uidcarte) => request("/api/scan-simulation", { method: "POST", body: { uidcarte } }),
  entreeManuelle: (uidcarte) => request("/api/entree", { method: "POST", body: { uidcarte } }),

  // ---- simulation 7 jours ---------------------------------------------
  demarrerSimulation: (candidatId) => request(`/simulation/start/${candidatId}`, { method: "POST" }),

  // ---- biométrie ---------------------------------------------------
  supprimerVisage: (employeId) => request(`/api/biometrie/${employeId}`, { method: "DELETE" }),
  
    // ---- présence live -------------------------------------------------
  listePresentsLive: () => request("/presences/live"),
  forceSortie: (employeId) =>
    request(`/presences/force-sortie/${employeId}`, { method: "POST" }),

  // ---- parcours employé ----------------------------------------------
  parcoursEmploye: (id) => request(`/employes/${id}/parcours`),
};

export { ApiError };
