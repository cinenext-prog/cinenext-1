import { useEffect, useRef } from 'react';

function useVideoReloadSync(onReload, videoKeySet, versionKey) {
  const lastVersionRef = useRef('');

  useEffect(() => {
    lastVersionRef.current = String(localStorage.getItem(versionKey) || '');

    const syncIfVersionChanged = () => {
      const current = String(localStorage.getItem(versionKey) || '');
      if (current && current !== lastVersionRef.current) {
        lastVersionRef.current = current;
        onReload();
      }
    };

    const onStorage = (event) => {
      if (!event.key) {
        onReload();
        return;
      }

      if (event.key === versionKey) {
        const next = String(event.newValue || '');
        if (next && next !== lastVersionRef.current) {
          lastVersionRef.current = next;
          onReload();
        }
        return;
      }

      if (!event.key || videoKeySet.has(event.key)) {
        onReload();
      }
    };

    const onFocus = () => {
      syncIfVersionChanged();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncIfVersionChanged();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [onReload, videoKeySet, versionKey]);
}

export default useVideoReloadSync;
