import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../api/client";

const WsContext = createContext(null);

const TOKEN_KEY = "admin_ws_token_v1";
const MAX_EVENTS = 300;
const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 15000;

function wsUrl(token) {
  const httpBase = API_BASE.replace(/\/+$/, "");
  const wsBase = httpBase.replace(/^http/i, (m) => (m.toLowerCase() === "https" ? "wss" : "ws"));
  return `${wsBase}/ws/admin?token=${encodeURIComponent(token)}`;
}

let idCounter = 0;

export function WsProvider({ children }) {
  const [token, setTokenState] = useState(
    () => localStorage.getItem(TOKEN_KEY) || import.meta.env.VITE_ADMIN_WS_TOKEN || "",
  );
  const [status, setStatus] = useState("idle"); // idle | connecting | open | closed | error
  const [events, setEvents] = useState([]);

  const socketRef = useRef(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef(null);
  const listeners = useRef(new Set());
  const closedByUser = useRef(false);

  const setToken = useCallback((next) => {
    localStorage.setItem(TOKEN_KEY, next);
    setTokenState(next);
  }, []);

  const subscribe = useCallback((eventNames, callback) => {
    const names = Array.isArray(eventNames) ? eventNames : [eventNames];
    const entry = { names, callback };
    listeners.current.add(entry);
    return () => listeners.current.delete(entry);
  }, []);

  const connect = useCallback(() => {
    if (!token) {
      setStatus("idle");
      return;
    }
    closedByUser.current = false;
    setStatus("connecting");
    const socket = new WebSocket(wsUrl(token));
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttempt.current = 0;
      setStatus("open");
    };

    socket.onmessage = (msg) => {
      let payload;
      try {
        payload = JSON.parse(msg.data);
      } catch {
        return;
      }
      const withMeta = { ...payload, _id: ++idCounter, _ts: Date.now() };
      setEvents((prev) => {
        const next = [withMeta, ...prev];
        return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
      });
      listeners.current.forEach(({ names, callback }) => {
        if (names.includes("*") || names.includes(payload.event)) callback(withMeta);
      });
    };

    socket.onerror = () => setStatus("error");

    socket.onclose = (ev) => {
      setStatus("closed");
      if (closedByUser.current) return;
      if (ev.code === 4403) return; // token refusé : inutile de boucler
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt.current, RECONNECT_MAX_MS);
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      closedByUser.current = true;
      clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const reconnectNow = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    reconnectAttempt.current = 0;
    socketRef.current?.close();
    connect();
  }, [connect]);

  const clearEvents = useCallback(() => setEvents([]), []);

  // Permet d'injecter un événement factice (bouton "Tester" côté Réglages)
  // sans dépendre du backend — pratique pour répéter l'effet roulette avant
  // l'ouverture de l'expo.
  const simulateEvent = useCallback((payload) => {
    const withMeta = { ...payload, _id: ++idCounter, _ts: Date.now() };
    setEvents((prev) => {
      const next = [withMeta, ...prev];
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
    });
    listeners.current.forEach(({ names, callback }) => {
      if (names.includes("*") || names.includes(payload.event)) callback(withMeta);
    });
  }, []);

  const value = useMemo(
    () => ({ status, events, token, setToken, subscribe, reconnectNow, clearEvents, simulateEvent }),
    [status, events, token, setToken, subscribe, reconnectNow, clearEvents, simulateEvent],
  );

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

export function useWs() {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("useWs doit être utilisé dans <WsProvider>");
  return ctx;
}
