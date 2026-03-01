import { useEffect } from 'react';

function useVideoReloadSync(onReload, videoKeySet) {
  useEffect(() => {
    const onStorage = (event) => {
      if (!event.key || videoKeySet.has(event.key)) {
        onReload();
      }
    };

    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [onReload, videoKeySet]);
}

export default useVideoReloadSync;
