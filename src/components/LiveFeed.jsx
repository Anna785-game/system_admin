import { useWs } from "../context/WsContext";
import { configEvenement, TONE_VARS } from "../constants/events";

function formatHeure(ts) {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function FeedTicker() {
  const { events } = useWs();
  const dernier = events[0];

  return (
    <div className="feedbar">
      <div className="feedbar-inner">
        {!dernier && <span className="mute mono">En attente d'événements…</span>}
        {events.slice(0, 14).map((ev) => {
          const cfg = configEvenement(ev.event);
          const [bright] = TONE_VARS[cfg.tone] || TONE_VARS.mute;
          return (
            <span key={ev._id} className="feedbar-item">
              <span className="feedbar-dot" style={{ background: bright }} />
              <span className="mono feedbar-time">{formatHeure(ev._ts)}</span>
              <span>{cfg.icon} {cfg.libelle(ev)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function FeedList({ limit = 100 }) {
  const { events, clearEvents } = useWs();
  const list = events.slice(0, limit);

  if (list.length === 0) {
    return (
      <div className="empty">
        <strong>Silence radio</strong>
        Aucun événement reçu pour l'instant. Les actions des visiteurs apparaîtront ici en direct.
      </div>
    );
  }

  return (
    <div className="feed-list">
      <div className="feed-list-head">
        <span className="mute mono">{list.length} événement{list.length > 1 ? "s" : ""}</span>
        <button className="btn btn-ghost btn-sm" onClick={clearEvents}>Vider</button>
      </div>
      {list.map((ev, i) => {
        const cfg = configEvenement(ev.event);
        return (
          <div key={ev._id} className={`feed-row tone-border-${cfg.tone} ${cfg.majeur ? "majeur" : ""} ${i === 0 ? "fresh" : ""}`}>
            <div className="feed-row-icon">{cfg.icon}</div>
            <div className="feed-row-body">
              <div className="feed-row-text">{cfg.libelle(ev)}</div>
              <div className="feed-row-meta mono">{ev.event} · {formatHeure(ev._ts)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
