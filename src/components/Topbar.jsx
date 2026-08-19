import { useEffect, useState } from "react";
import Icon from "./Icon";
import { useWs } from "../context/WsContext";
import { api } from "../api/client";

const STATUS_LABEL = {
  idle: ["En attente", "mute"],
  connecting: ["Connexion…", "yellow"],
  open: ["En direct", "green"],
  closed: ["Coupé — reconnexion…", "red"],
  error: ["Erreur", "red"],
};

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Topbar() {
  const { status } = useWs();
  const now = useClock();
  const [stats, setStats] = useState({ en_attente: null, deja_passes: null });
  const [employesActifs, setEmployesActifs] = useState(null);

  async function refresh() {
    try {
      const s = await api.statsCandidats();
      setStats(s);
    } catch { /* silencieux sur le bandeau, pas critique */ }
    try {
      const emp = await api.listeEmployes();
      setEmployesActifs(emp.filter((e) => e.status === "Actif").length);
    } catch { /* idem */ }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  const { subscribe } = useWs();
  useEffect(() => subscribe(
    ["inscription", "candidat_actif", "retrait", "vire_manuel", "employe_actif", "roulette", "carte_assignee", "simulation_end"],
    refresh,
  ), [subscribe]);

  const [label, tone] = STATUS_LABEL[status] || STATUS_LABEL.idle;

  return (
    <header className="topbar">
      <div className="topbar-stats">
        <StatTile label="File d'attente" value={stats.en_attente} tone="yellow" />
        <StatTile label="Historique" value={stats.deja_passes} tone="mute" />
        <StatTile label="Employés actifs" value={employesActifs} tone="green" />
      </div>

      <div className="topbar-clock mono">
        {now.toLocaleTimeString("fr-FR")}
        <span className="dim"> · {now.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })}</span>
      </div>

      <div className={`topbar-ws badge badge-${tone}`}>
        <Icon name="wifi" size={12} />
        {label}
      </div>
    </header>
  );
}

function StatTile({ label, value, tone }) {
  return (
    <div className={`stat-tile tone-${tone}`}>
      <div className="stat-tile-value mono">{value === null ? "—" : value}</div>
      <div className="stat-tile-label">{label}</div>
    </div>
  );
}
