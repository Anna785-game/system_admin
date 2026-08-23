/**
 * ParcoursModal — vue détaillée et visuelle du parcours d'un employé.
 *
 * Utilisé depuis :
 *  - EmployesPanel  : clic sur n'importe quelle ligne (Actif / Inactif / Tous)
 *  - HistoriquePanel: clic sur un employé (vue jour ou résultats de recherche)
 *
 * Récupère GET /employes/{id}/parcours et affiche :
 *  - un en-tête avec les infos de l'employé
 *  - des indicateurs clés (jours suivis, présences, absences, durée moyenne, total)
 *  - un graphe en barres (durée travaillée / jour, 14 derniers jours avec données)
 *  - un donut de répartition des statuts (présent / absent / viré)
 *  - la liste des jours (accordéon) avec le détail des événements de chaque jour
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import Icon from "./Icon";
import "../styles/parcours-modal.css";

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatTitreLong(iso) {
  const d = parseISODate(iso);
  const s = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTitreCourt(iso) {
  const d = parseISODate(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function formatHeure(h) {
  if (!h) return "—";
  return h.length >= 5 ? h.slice(0, 5) : h;
}

function formatDuree(min) {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

const STATUT_BADGE = {
  present: "badge-green",
  absent: "badge-yellow",
  vire: "badge-red",
  Actif: "badge-green",
  Inactif: "badge-red",
};

const STATUT_LABEL = {
  present: "Présent",
  absent: "Absent",
  vire: "Viré",
  Actif: "Actif",
  Inactif: "Inactif",
};

const TONE_HEX = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  blue: "#3b82f6",
  mute: "#6b7280",
};

function resumeJour(events) {
  const hasVire = events.some(
    (e) => e.type === "absence" && (e.detail || "").startsWith("Viré")
  );
  if (hasVire) return { statut: "vire", label: "Viré", tone: "red" };
  const hasAbs = events.some((e) => e.type === "absence");
  if (hasAbs) return { statut: "absent", label: "Absent", tone: "yellow" };
  return { statut: "present", label: "Présent", tone: "green" };
}

/* ---------------------------------------------------------------------- */
/* Graphe en barres : durée travaillée par jour                            */
/* ---------------------------------------------------------------------- */
function BarChartDuree({ data }) {
  const W = 560;
  const H = 170;
  const padL = 34;
  const padB = 24;
  const padT = 10;
  const innerW = W - padL - 10;
  const innerH = H - padT - padB;

  if (!data.length) {
    return (
      <div className="pm-chart-empty">Pas encore de journée travaillée enregistrée.</div>
    );
  }

  const max = Math.max(...data.map((d) => d.duree_minutes), 60);
  const barGap = 8;
  const barW = Math.max(6, innerW / data.length - barGap);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pm-chart-svg" role="img" aria-label="Durée travaillée par jour">
      {/* lignes de repère horizontales */}
      {[0, 0.5, 1].map((f) => {
        const y = padT + innerH * (1 - f);
        return (
          <line
            key={f}
            x1={padL}
            x2={W - 6}
            y1={y}
            y2={y}
            stroke="var(--pm-grid, rgba(255,255,255,0.08))"
            strokeDasharray="3 4"
          />
        );
      })}
      {/* labels axe Y en heures */}
      {[0, 0.5, 1].map((f) => {
        const y = padT + innerH * (1 - f);
        const val = Math.round(((max * f) / 60) * 10) / 10;
        return (
          <text key={f} x={0} y={y + 4} className="pm-axis-label">
            {val}h
          </text>
        );
      })}
      {data.map((d, i) => {
        const h = Math.max(3, (d.duree_minutes / max) * innerH);
        const x = padL + i * (barW + barGap);
        const y = padT + innerH - h;
        const isPresent = d.duree_minutes > 0;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={3}
              fill={isPresent ? "var(--pm-accent, #6366f1)" : TONE_HEX.mute}
              opacity={isPresent ? 0.9 : 0.4}
            >
              <title>
                {formatTitreLong(d.date)} — {formatDuree(d.duree_minutes)}
              </title>
            </rect>
            <text
              x={x + barW / 2}
              y={H - 6}
              textAnchor="middle"
              className="pm-axis-label"
            >
              {formatTitreCourt(d.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Donut : répartition présent / absent / viré                             */
/* ---------------------------------------------------------------------- */
function DonutChart({ segments }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const size = 132;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  if (total === 0) {
    return <div className="pm-chart-empty">Aucune journée enregistrée.</div>;
  }

  let offsetAcc = 0;
  return (
    <div className="pm-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Répartition des statuts">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--pm-grid, rgba(255,255,255,0.08))" strokeWidth={stroke} />
        {segments
          .filter((seg) => seg.value > 0)
          .map((seg) => {
            const frac = seg.value / total;
            const dash = frac * c;
            const dashArray = `${dash} ${c - dash}`;
            const dashOffset = -offsetAcc;
            offsetAcc += dash;
            return (
              <circle
                key={seg.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={TONE_HEX[seg.tone] || TONE_HEX.mute}
                strokeWidth={stroke}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${cx} ${cy})`}
                strokeLinecap="butt"
              >
                <title>{seg.label} — {seg.value}</title>
              </circle>
            );
          })}
        <text x={cx} y={cy - 3} textAnchor="middle" className="pm-donut-total">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="pm-donut-sub">
          jour{total !== 1 ? "s" : ""}
        </text>
      </svg>
      <div className="pm-legend">
        {segments.map((seg) => (
          <div key={seg.label} className="pm-legend-item">
            <span className="pm-legend-dot" style={{ background: TONE_HEX[seg.tone] || TONE_HEX.mute }} />
            {seg.label}
            <strong>{seg.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Modal principal                                                         */
/* ---------------------------------------------------------------------- */
export default function ParcoursModal({ employe, onClose }) {
  const [parcours, setParcours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDay, setOpenDay] = useState(null);

  const employeId = employe?.employe_id ?? employe?.id;

  useEffect(() => {
    if (!employeId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setParcours(null);
    setOpenDay(null);
    api
      .parcoursEmploye(employeId)
      .then((p) => {
        if (!cancelled) setParcours(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Impossible de charger le parcours.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeId]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const joursParcours = useMemo(() => {
    if (!parcours?.timeline) return [];
    const map = new Map();
    for (const ev of parcours.timeline) {
      if (!map.has(ev.date)) map.set(ev.date, []);
      map.get(ev.date).push(ev);
    }
    return Array.from(map.entries())
      .map(([date, events]) => ({ date, events, ...resumeJour(events) }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [parcours]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, vire: 0 };
    for (const j of joursParcours) c[j.statut] += 1;
    return c;
  }, [joursParcours]);

  const dureesChart = useMemo(() => {
    const list = (parcours?.durees_par_jour || [])
      .filter((d) => d.duree_minutes != null)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    return list.slice(-14);
  }, [parcours]);

  const kpis = useMemo(() => {
    const joursPresents = (parcours?.durees_par_jour || []).filter((d) => d.duree_minutes > 0);
    const totalMinutes = joursPresents.reduce((s, d) => s + d.duree_minutes, 0);
    const moyenne = joursPresents.length ? Math.round(totalMinutes / joursPresents.length) : null;
    return {
      totalJours: joursParcours.length,
      presences: counts.present,
      absences: counts.absent,
      moyenne,
      total: totalMinutes,
    };
  }, [parcours, joursParcours, counts]);

  const nom = `${employe?.nom || parcours?.nom || ""} ${employe?.prenom || parcours?.prenom || ""}`.trim();

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pm-header">
          <div>
            <div className="eyebrow">Parcours employé</div>
            <h2 className="pm-title">{nom || "—"}</h2>
            <div className="pm-submeta">
              <span className="mono">{employe?.matricule || parcours?.matricule || "—"}</span>
              {(employe?.poste || parcours?.id_poste) && (
                <span> · {employe?.poste || `Poste #${parcours?.id_poste}`}</span>
              )}
              {parcours?.status && (
                <span
                  className={`badge ${STATUT_BADGE[parcours.status] || "badge-mute"}`}
                  style={{ marginLeft: 10 }}
                >
                  {STATUT_LABEL[parcours.status] || parcours.status}
                </span>
              )}
              {parcours?.is_present && (
                <span className="badge badge-green" style={{ marginLeft: 6 }}>
                  Présent maintenant
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={15} />
          </button>
        </div>

        <div className="pm-body">
          {loading && <div className="empty">Chargement du parcours…</div>}
          {error && <div className="empty">{error}</div>}

          {!loading && !error && parcours && (
            <>
              <div className="pm-kpi-grid">
                <div className="pm-kpi">
                  <span className="pm-kpi-label">Jours suivis</span>
                  <span className="pm-kpi-value">{kpis.totalJours}</span>
                </div>
                <div className="pm-kpi">
                  <span className="pm-kpi-label">Présences</span>
                  <span className="pm-kpi-value pm-tone-green">{kpis.presences}</span>
                </div>
                <div className="pm-kpi">
                  <span className="pm-kpi-label">Absences</span>
                  <span className="pm-kpi-value pm-tone-yellow">{kpis.absences}</span>
                </div>
                <div className="pm-kpi">
                  <span className="pm-kpi-label">Durée moy. / jour</span>
                  <span className="pm-kpi-value">{formatDuree(kpis.moyenne)}</span>
                </div>
                <div className="pm-kpi">
                  <span className="pm-kpi-label">Total travaillé</span>
                  <span className="pm-kpi-value">{formatDuree(kpis.total)}</span>
                </div>
              </div>

              <div className="pm-charts-grid">
                <div className="pm-chart-card">
                  <div className="pm-chart-title">Durée travaillée (14 derniers jours actifs)</div>
                  <BarChartDuree data={dureesChart} />
                </div>
                <div className="pm-chart-card pm-chart-card-donut">
                  <div className="pm-chart-title">Répartition des statuts</div>
                  <DonutChart
                    segments={[
                      { label: "Présent", value: counts.present, tone: "green" },
                      { label: "Absent", value: counts.absent, tone: "yellow" },
                      { label: "Viré", value: counts.vire, tone: "red" },
                    ]}
                  />
                </div>
              </div>

              <div className="pm-days-section">
                <div className="pm-chart-title" style={{ marginBottom: 8 }}>
                  Journal ({joursParcours.length} jour{joursParcours.length !== 1 ? "s" : ""})
                </div>
                {joursParcours.length === 0 && (
                  <div className="empty">Aucun événement enregistré pour cet employé.</div>
                )}
                <div className="pm-days-list">
                  {joursParcours.map((j) => {
                    const isOpen = openDay === j.date;
                    return (
                      <div key={j.date} className="pm-day">
                        <button
                          type="button"
                          className="pm-day-head"
                          onClick={() => setOpenDay(isOpen ? null : j.date)}
                        >
                          <span className="pm-day-chevron">{isOpen ? "▾" : "▸"}</span>
                          <span className="pm-day-title">{formatTitreLong(j.date)}</span>
                          <span className="mute" style={{ fontSize: 12 }}>
                            {j.events.length} événement{j.events.length > 1 ? "s" : ""}
                          </span>
                          <span className={`badge ${STATUT_BADGE[j.statut] || "badge-mute"}`}>
                            {j.label}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="parcours-timeline pm-day-body">
                            {j.events.map((ev, i) => (
                              <div
                                key={`${ev.type}-${ev.heure || i}`}
                                className={`parcours-item tone-border-${
                                  ev.type === "entree"
                                    ? "green"
                                    : ev.type === "sortie"
                                      ? "blue"
                                      : ev.type === "absence"
                                        ? "red"
                                        : "mute"
                                }`}
                              >
                                <div className="parcours-icon">
                                  {ev.type === "entree" ? "→" : ev.type === "sortie" ? "←" : "•"}
                                </div>
                                <div className="parcours-body">
                                  <div className="parcours-label">{ev.label}</div>
                                  {ev.detail && (
                                    <div className="parcours-meta" style={{ marginTop: 2 }}>
                                      {ev.detail}
                                    </div>
                                  )}
                                  <div className="parcours-meta mono">
                                    {ev.heure ? formatHeure(ev.heure) : ""}
                                    {ev.duree_minutes != null ? ` · ${formatDuree(ev.duree_minutes)}` : ""}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
