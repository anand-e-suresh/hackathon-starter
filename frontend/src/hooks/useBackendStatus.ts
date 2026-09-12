/**
 * useBackendStatus — polls GET / every 5s to check backend health.
 * Returns { online, latency, checking }
 */
import { useState, useEffect, useRef } from 'react';
import { checkHealth } from '../api/client';

interface BackendStatus {
  online: boolean;
  latency: number | null;
  checking: boolean;
}

export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>({
    online: false,
    latency: null,
    checking: true,
  });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    async function check() {
      const t0 = performance.now();
      try {
        await checkHealth();
        const latency = Math.round(performance.now() - t0);
        if (isMounted.current) {
          setStatus({ online: true, latency, checking: false });
        }
      } catch {
        if (isMounted.current) {
          setStatus({ online: false, latency: null, checking: false });
        }
      }
    }

    check();
    const id = setInterval(check, 5000);

    return () => {
      isMounted.current = false;
      clearInterval(id);
    };
  }, []);

  return status;
}
