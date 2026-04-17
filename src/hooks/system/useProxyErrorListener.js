import { useEffect } from 'react';
import { useToast } from '../useToast';

/**
 * Subscribes to `proxy-bind-error` events from the Rust local_proxy module and
 * surfaces them via the global toast. The event is emitted by src-tauri/src/local_proxy.rs
 * when a TCP/UDP bind fails (most commonly AddrInUse when another process —
 * often a second Reachy Mini instance — holds the port).
 */
export function useProxyErrorListener() {
  const { showToast } = useToast();

  useEffect(() => {
    let unlisten;
    let cancelled = false;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unsub = await listen('proxy-bind-error', event => {
          const { port, protocol, kind } = event.payload || {};
          const proto = typeof protocol === 'string' ? protocol.toUpperCase() : 'port';
          const message =
            kind === 'AddrInUse'
              ? `Port ${port} is already in use — another Reachy Mini instance may be running.`
              : `Failed to bind ${proto} port ${port}. Check that no other app is using it.`;
          showToast(message, 'error');
        });

        if (cancelled) {
          unsub();
        } else {
          unlisten = unsub;
        }
      } catch (e) {
        // Tauri event API not available (web preview); nothing to do.
      }
    })();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [showToast]);
}
