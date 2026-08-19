// La roue (public/roulette.png) est divisée en 3 secteurs de 120°, mesurés
// en degrés horaires depuis midi (0° = pointeur, en haut) :
//   Bleu   :   0° -> 120°  (haut-droite)
//   Jaune  : 120° -> 240°  (bas)
//   Rouge  : 240° -> 360°  (haut-gauche)
//
// Table de correspondance métier <-> secteur, telle que définie pour l'expo :
//   Rouge  -> Vendeur
//   Bleu   -> Nettoyeur de toilettes
//   Jaune  -> Boss
//
// Les noms ci-dessous doivent matcher EXACTEMENT `type_poste` en base
// (voir POST /postes/seed-demo côté API).

export const SEGMENTS = [
  { poste: "Vendeur", tone: "red", start: 0, end: 120, icon: "🏪" },
  { poste: "Nettoyeur de toilettes", tone: "blue", start: 240, end: 360, icon: "🚰" },
  { poste: "Boss", tone: "yellow", start: 120, end: 240, icon: "👑" },
];

const TONE_HEX = {
  red: { solid: "var(--red)", bright: "var(--red-bright)" },
  blue: { solid: "var(--blue)", bright: "var(--blue-bright)" },
  yellow: { solid: "var(--yellow)", bright: "var(--yellow-bright)" },
};

export function posteInfo(nomPoste) {
  const seg = SEGMENTS.find((s) => s.poste === nomPoste);
  if (!seg) {
    return { poste: nomPoste || "Poste inconnu", tone: "mute", icon: "❔", start: 0, end: 0 };
  }
  return seg;
}

export function toneHex(tone) {
  return TONE_HEX[tone] || { solid: "var(--text-mute)", bright: "var(--text-dim)" };
}

// Angle (0-360, horaire depuis le haut) du CENTRE du secteur d'un poste donné.
export function segmentCenterAngle(nomPoste) {
  const seg = posteInfo(nomPoste);
  if (seg.start === seg.end) return 0;
  const span = (seg.end - seg.start + 360) % 360 || 360;
  return (seg.start + span / 2) % 360;
}
