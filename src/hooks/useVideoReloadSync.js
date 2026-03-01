import { useEffect } from 'react';

function useVideoReloadSync(onReload, videoKeySet) {
  useEffect(() => {
    const onStorage = (event) => {
      if (!event.key || videoKeySet.has(event.key)) {
        onReload();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        onReload();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onReload);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onReload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [onReload, videoKeySet]);
}

export default useVideoReloadSync;
