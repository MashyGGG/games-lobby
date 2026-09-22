function getBrowserStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function createWebPlatform({ storage = getBrowserStorage(), navigatorApi = globalThis.navigator, documentApi = globalThis.document } = {}) {
  return {
    kind: 'web',
    storage,
    haptics: {
      vibrate(pattern) {
        if (typeof navigatorApi?.vibrate !== 'function') return false;
        return navigatorApi.vibrate(pattern);
      }
    },
    lifecycle: {
      subscribe({ onHide, onShow } = {}) {
        if (!documentApi?.addEventListener) return () => {};
        let hidden = Boolean(documentApi.hidden);
        const handleVisibility = () => {
          const next = Boolean(documentApi.hidden);
          if (next === hidden) return;
          hidden = next;
          (hidden ? onHide : onShow)?.();
        };
        documentApi.addEventListener('visibilitychange', handleVisibility);
        return () => documentApi.removeEventListener('visibilitychange', handleVisibility);
      }
    }
  };
}
