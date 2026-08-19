import { useCallback, useEffect, useState } from "react";
import { useWs } from "../context/WsContext";

export function useResource(fetcher, { refreshOn = [], deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { subscribe } = useWs();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      setData(res);
    } catch (e) {
      setError(e.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (refreshOn.length === 0) return undefined;
    return subscribe(refreshOn, () => reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, reload]);

  return { data, loading, error, reload, setData };
}
