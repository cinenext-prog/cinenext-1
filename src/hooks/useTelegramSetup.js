import { useEffect } from 'react';

const getTelegramWebApp = () => window.Telegram?.WebApp || null;

const applyMiniAppTopOffset = (tg) => {
  const root = document.documentElement;
  const contentSafeTop = Number(tg?.contentSafeAreaInset?.top ?? tg?.safeAreaInset?.top ?? 0);

  if (Number.isFinite(contentSafeTop) && contentSafeTop > 0) {
    root.style.setProperty('--miniapp-top-offset', `${Math.round(contentSafeTop + 10)}px`);
    return;
  }

  root.style.setProperty('--miniapp-top-offset', '92px');
};

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
    if (typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes();
    }
    applyMiniAppTopOffset(tg);

    const handleViewportChanged = () => applyMiniAppTopOffset(tg);
    if (typeof tg.onEvent === 'function') {
      tg.onEvent('viewportChanged', handleViewportChanged);
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

    return () => {
      if (typeof tg.offEvent === 'function') {
        tg.offEvent('viewportChanged', handleViewportChanged);
      }
    };
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
