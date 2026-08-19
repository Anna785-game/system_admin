// Décrit chaque `event` broadcasté par app/core/ws_manager.py (voir v.txt)
// pour l'affichage dans le fil d'actualité en direct.

const DEFAULT = {
  tone: "mute",
  icon: "•",
  majeur: false,
  libelle: (d) => d.message || d.event || "Événement",
};

const REGISTRY = {
  inscription: {
    tone: "blue",
    icon: "📝",
    majeur: false,
    libelle: (d) => `${d.candidat?.nom || "Un visiteur"} s'inscrit à l'accueil.`,
  },
  candidat_actif: {
    tone: "yellow",
    icon: "➡️",
    majeur: true,
    libelle: (d) => `${d.candidat?.nom || "Le candidat"} est appelé au poste d'enregistrement.`,
  },
  retrait: {
    tone: "mute",
    icon: "↩️",
    majeur: false,
    libelle: () => "Retrait du candidat en cours.",
  },
  vire_manuel: {
    tone: "red",
    icon: "🚫",
    majeur: true,
    libelle: (d) => d.message || `${d.candidat?.nom || "Un employé"} a été viré.`,
  },
  roulette: {
    tone: "gold",
    icon: "🎡",
    majeur: true,
    libelle: (d) => `Roue lancée pour ${d.candidat?.nom || "un candidat"}…`,
  },
  employe_actif: {
    tone: "green",
    icon: "🎉",
    majeur: true,
    libelle: (d) => d.message || `Nouvel employé : poste ${d.poste}.`,
  },
  carte_assignee: {
    tone: "gold",
    icon: "💳",
    majeur: false,
    libelle: (d) => d.message || `Carte ${d.carte_uid} assignée.`,
  },
  entree_entreprise: {
    tone: "green",
    icon: "🟢",
    majeur: false,
    libelle: (d) => d.message || `${d.nom} est entré.`,
  },
  sortie_entreprise: {
    tone: "blue",
    icon: "🔵",
    majeur: false,
    libelle: (d) => d.message || `${d.nom} est sorti.`,
  },
  acces_refuse: {
    tone: "red",
    icon: "⛔",
    majeur: true,
    libelle: (d) => d.message || `Accès refusé (${d.reason}).`,
  },
  simulation_start: {
    tone: "yellow",
    icon: "▶️",
    majeur: true,
    libelle: (d) => d.message || `Simulation démarrée pour ${d.candidat?.nom}.`,
  },
  simulation_day: {
    tone: "blue",
    icon: "📅",
    majeur: false,
    libelle: (d) => `J${d.jour} — ${d.candidat?.nom || "employé"} : ${d.description}`,
  },
  simulation_end: {
    tone: "red",
    icon: "🏁",
    majeur: true,
    libelle: (d) => d.message || `Simulation terminée (${d.raison}).`,
  },
};

export function configEvenement(eventName) {
  return REGISTRY[eventName] || DEFAULT;
}

export const TONE_VARS = {
  red: ["var(--red-bright)", "var(--red-dim)"],
  blue: ["var(--blue-bright)", "var(--blue-dim)"],
  yellow: ["var(--yellow-bright)", "var(--yellow-dim)"],
  green: ["var(--green-bright)", "var(--green-dim)"],
  gold: ["var(--gold-bright)", "var(--gold-dim)"],
  mute: ["var(--text-dim)", "rgba(255,255,255,0.04)"],
};
