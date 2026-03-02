import { useEffect } from 'react';

const getTelegramWebApp = () => window.Telegram?.WebApp || null;

const requestTelegramFullscreen = (tg) => {
  if (!tg) {
    return;
  }

  try {
    if (typeof tg.requestFullscreen === 'function') {
      tg.requestFullscreen();
      return;
    }

    const webView = window.Telegram?.WebView;
    if (typeof webView?.postEvent === 'function') {
      webView.postEvent('web_app_request_fullscreen');
    }
  } catch {
    // ignore fullscreen capability errors on unsupported clients
  }
};

function useTelegramSetup(page, setPage) {
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) {
      return;
    }

    tg.ready();
    tg.expand();
    requestTelegramFullscreen(tg);
    if (typeof tg.enableVerticalSwipes === 'function') {
      tg.enableVerticalSwipes();
    }

    const theme = tg.themeParams || {};
    const root = document.documentElement;
    if (theme.bg_color) {
      root.style.setProperty('--tg-theme-bg-color', theme.bg_color);
    }
    if (theme.text_color) {
      root.style.setProperty('--tg-theme-text-color', theme.text_color);
    }
    if (theme.hint_color) {
      root.style.setProperty('--tg-theme-hint-color', theme.hint_color);
    }
    if (theme.button_color) {
      root.style.setProperty('--tg-theme-button-color', theme.button_color);
    }
    if (theme.button_text_color) {
      root.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
    }
  }, []);

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg?.BackButton) {
      return;
    }

    const onBack = () => setPage('home');
    tg.BackButton.onClick(onBack);

    if (page === 'search') {
      tg.BackButton.show();
    } else {
      tg.BackButton.hide();
    }

    return () => {
      tg.BackButton.offClick(onBack);
    };
  }, [page, setPage]);
}

export default useTelegramSetup;
