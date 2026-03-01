import { useEffect, useState } from 'react';
import { safeGet, safeSet } from '../lib/storage';

function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => safeGet(key, initialValue));

  useEffect(() => {
    safeSet(key, state);
  }, [key, state]);

  return [state, setState];
}

export default usePersistentState;
