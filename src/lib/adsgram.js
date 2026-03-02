const ADSGRAM_SCRIPT_SRC = 'https://sad.adsgram.ai/js/sad.min.js';

let adsgramLoadPromise;

export const loadAdsgramSdk = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('AdsGram is only available in browser'));
  }

  if (window.Adsgram) {
    return Promise.resolve(window.Adsgram);
  }

  if (!adsgramLoadPromise) {
    adsgramLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${ADSGRAM_SCRIPT_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Adsgram));
        existing.addEventListener('error', () => reject(new Error('Failed to load AdsGram SDK')));
        return;
      }

      const script = document.createElement('script');
      script.src = ADSGRAM_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve(window.Adsgram);
      script.onerror = () => reject(new Error('Failed to load AdsGram SDK'));
      document.head.appendChild(script);
    });
  }

  return adsgramLoadPromise;
};

export const showRewardedAd = async ({ blockId }) => {
  if (!blockId) {
    throw new Error('VITE_ADSGRAM_BLOCK_ID is missing');
  }

  const adsgram = await loadAdsgramSdk();
  if (!adsgram) {
    throw new Error('AdsGram SDK not available');
  }

  if (typeof adsgram.init === 'function') {
    const controller = adsgram.init({ blockId });
    if (controller && typeof controller.show === 'function') {
      return controller.show();
    }
  }

  if (typeof adsgram.show === 'function') {
    return adsgram.show({ blockId });
  }

  if (typeof adsgram.showRewardedAd === 'function') {
    return adsgram.showRewardedAd({ blockId });
  }

  throw new Error('AdsGram SDK API is not compatible');
};
