import { useCallback, useEffect, useRef, useState } from "react";
import { useWs } from "../context/WsContext";
import { posteInfo, segmentCenterAngle, toneHex } from "../constants/postes";

const SPIN_DURATION_MS = 6800;
const EXTRA_TURNS_DEG = 7200;
const REVEAL_HOLD_MS = 7000;

export default function RouletteOverlay() {
  const { subscribe } = useWs();
  const [round, setRound] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | spinning | reveal
  const rotationRef = useRef(0);
  const [rotation, setRotation] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const dismissTimer = useRef(null);
  const revealTimer = useRef(null);

  const launch = useCallback((data) => {
    clearTimeout(dismissTimer.current);
    clearTimeout(revealTimer.current);

    const poste = data.poste_gagnant;
    const center = segmentCenterAngle(poste);
    const jitter = (Math.random() - 0.5) * 70;
    const target = ((center + jitter) % 360 + 360) % 360;

    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    const delta = ((target - currentMod) % 360 + 360) % 360;
    const next = rotationRef.current + EXTRA_TURNS_DEG + delta;
    rotationRef.current = next;

    setRound({
      candidatNom: data.candidat?.nom || "Le candidat",
      poste,
      repartition: data.repartition || [],
    });

    // 1. Afficher la roue SANS transition (position actuelle)
    setTransitionEnabled(false);
    setPhase("spinning");
    setRotation(rotationRef.current - EXTRA_TURNS_DEG - delta); // forcer le frame de départ

    // 2. Au frame suivant, activer la transition et aller à la cible
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionEnabled(true);
        setRotation(next);
      });
    });

    revealTimer.current = setTimeout(() => setPhase("reveal"), SPIN_DURATION_MS);
    dismissTimer.current = setTimeout(() => setPhase("idle"), SPIN_DURATION_MS + REVEAL_HOLD_MS);
  }, []);

  useEffect(() => subscribe(["roulette"], launch), [subscribe, launch]);

  useEffect(() => () => {
    clearTimeout(dismissTimer.current);
    clearTimeout(revealTimer.current);
  }, []);

  if (phase === "idle" || !round) return null;

  const info = posteInfo(round.poste);
  const hex = toneHex(info.tone);

  return (
    <div className="roulette-overlay" role="dialog" aria-label="Tirage du poste">
      <button className="roulette-close" onClick={() => setPhase("idle")} aria-label="Fermer">✕</button>

      <div className="roulette-heading">
        <div className="eyebrow">Tirage en cours</div>
        <h1 className="roulette-name">{round.candidatNom}</h1>
      </div>

      <div className="roulette-stage">
        <div className="roulette-pointer" />
        <div
          className="roulette-wheel-wrap"
          style={{
            transform: `rotate(${rotation}deg)`,
            transitionDuration: transitionEnabled ? `${SPIN_DURATION_MS}ms` : "0ms",
          }}
        >
          <img src="/roulette.png" alt="Roue des postes" className="roulette-wheel-img" />
        </div>
        <div className="roulette-hub-glow" />
      </div>

      <div
        className={`roulette-result ${phase === "reveal" ? "show" : ""}`}
        style={{ "--tone": hex.solid, "--tone-bright": hex.bright }}
      >
        <div className="roulette-result-icon">{info.icon}</div>
        <div className="eyebrow">Poste attribué</div>
        <div className="roulette-result-poste">{info.poste}</div>
        {phase === "reveal" && <Confetti tone={info.tone} />}
      </div>

      {round.repartition.length > 0 && (
        <div className="roulette-odds">
          {round.repartition.map((r) => (
            <span key={r.poste} className="roulette-odds-item mono">
              {r.poste} · {r.pourcentage}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Confetti({ tone }) {
  const pieces = Array.from({ length: 26 });
  const colors = { red: "var(--red-bright)", blue: "var(--blue-bright)", yellow: "var(--yellow-bright)", mute: "var(--gold-bright)" };
  return (
    <div className="confetti">
      {pieces.map((_, i) => {
        const angle = (360 / pieces.length) * i;
        const dist = 90 + Math.random() * 70;
        const delay = Math.random() * 0.15;
        const size = 5 + Math.random() * 5;
        const palette = [colors[tone] || colors.mute, "var(--gold-bright)", "var(--text)"];
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{
              "--angle": `${angle}deg`,
              "--dist": `${dist}px`,
              "--delay": `${delay}s`,
              width: size,
              height: size * 0.4,
              background: palette[i % palette.length],
            }}
          />
        );
      })}
    </div>
  );
}
