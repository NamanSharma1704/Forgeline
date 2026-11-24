'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Registers the service worker (/sw.js) and, when a new build has been installed behind the one in
 * charge, offers to reload into it. It never swaps silently: a page halfway through a check should
 * not change under the player, and a stale page should not stay without saying so (M6).
 *
 * Skipped in development, where Next's dev server and a caching worker would fight.
 */
export function ServiceWorkerManager() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloadRequested = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;

    const watch = (worker: ServiceWorker) => {
      worker.addEventListener('statechange', () => {
        // Installed while another worker controls the page: a new build is ready.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
      });
    };

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((found) => {
        registration = found;
        if (found.waiting && navigator.serviceWorker.controller) setWaiting(found.waiting);
        if (found.installing) watch(found.installing);
        found.addEventListener('updatefound', () => found.installing && watch(found.installing));
      })
      .catch(() => {
        // No worker: the site still works online, just not offline.
      });

    // Look for a new build whenever the player comes back to the tab.
    const onVisible = () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);

    // The first worker takes control on its own; only reload when the player asked for it.
    const onControllerChange = () => {
      if (reloadRequested.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div className="update-bar" role="status">
      <p>Forgeline has new weapon data or features.</p>
      <button
        type="button"
        className="button button--small"
        onClick={() => {
          reloadRequested.current = true;
          waiting.postMessage({ type: 'SKIP_WAITING' });
        }}
      >
        Reload
      </button>
      <button type="button" className="icon-button" aria-label="Later" onClick={() => setWaiting(null)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
          <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
        </svg>
      </button>
    </div>
  );
}
