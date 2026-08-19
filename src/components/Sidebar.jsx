import Icon from "./Icon";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { id: "live", label: "Direct", icon: "radio" },
  { id: "candidats", label: "Candidats", icon: "users" },
  { id: "employes", label: "Employés", icon: "idCard" },
  { id: "historique", label: "Historique", icon: "history" },
  { id: "postes", label: "Postes & roue", icon: "dial" },
  { id: "cartes", label: "Cartes RFID", icon: "cardId" },
  { id: "presences", label: "Présences", icon: "clock" },
  { id: "simulation", label: "Simulation 7j", icon: "briefcase" },
  { id: "reglages", label: "Réglages", icon: "settings" },
];

export default function Sidebar({ active, onChange }) {
  const { session, logout } = useAuth();

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" stroke="var(--gold)" strokeWidth="2.4" />
            <path d="M20 2 A18 18 0 0 1 35.6 11" stroke="var(--red)" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M35.6 29 A18 18 0 0 1 20 38" stroke="var(--yellow)" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M4.4 29 A18 18 0 0 1 4.4 11" stroke="var(--blue)" strokeWidth="3.4" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div className="sidebar-brand-title">Régie</div>
          <div className="sidebar-brand-sub">Pointage &amp; Sécurité</div>
        </div>
      </div>

      <div className="sidebar-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${active === item.id ? "active" : ""}`}
            onClick={() => onChange(item.id)}
          >
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <div className="sidebar-user-dot" />
          <div className="sidebar-user-email mono">{session?.email}</div>
        </div>
        <button className="btn btn-ghost btn-sm btn-block" onClick={logout}>
          <Icon name="logout" size={14} />
          Se déconnecter
        </button>
      </div>
    </nav>
  );
}
