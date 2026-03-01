import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import '../player.css';

const LONG_PRESS_MS = 450;
const AUTOPLAY_UNLOCK_KEY = 'cinenext_autoplay_unlocked';

const VideoPlayer = ({
  sourceUrl,
  poster,
  title,
  active,
  preload,
  blocked,
  lockLabel,
  onUnlock,
}) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const autoplayRetryTimerRef = useRef(null);

  const [isPaused, setIsPaused] = useState(false);
  const [showSpeedSheet, setShowSpeedSheet] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playError, setPlayError] = useState('');
  const [needUserStart, setNeedUserStart] = useState(false);

  const isHlsSource = typeof sourceUrl === 'string' && /\.m3u8(\?|$)/i.test(sourceUrl);

  const attemptAutoplay = () => {
    const video = videoRef.current;
    if (!video || !active || blocked) {
      return;
    }

    if (needUserStart) {
      return;
    }

    const tryPlay = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
          setIsPaused(true);
          const name = error?.name || '';
          if (name === 'NotAllowedError') {
            setNeedUserStart(true);
          }
        });
      }
    };

    tryPlay();

    if (autoplayRetryTimerRef.current) {
      window.clearTimeout(autoplayRetryTimerRef.current);
    }

    autoplayRetryTimerRef.current = window.setTimeout(() => {
      if (video.paused) {
        tryPlay();
      }
    }, 280);
  };

  const handleUserStart = (event) => {
    event.stopPropagation();

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const playPromise = video.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          setNeedUserStart(false);
          sessionStorage.setItem(AUTOPLAY_UNLOCK_KEY, '1');
        })
        .catch(() => {
          setNeedUserStart(true);
        });
      return;
    }

    setNeedUserStart(false);
    sessionStorage.setItem(AUTOPLAY_UNLOCK_KEY, '1');
  };

  useEffect(() => {
    const unlocked = sessionStorage.getItem(AUTOPLAY_UNLOCK_KEY) === '1';
    if (unlocked) {
      setNeedUserStart(false);
    }

    const video = videoRef.current;
    if (!video || !sourceUrl || !preload) {
      return;
    }

    setPlayError('');

    video.loop = true;
    video.playsInline = true;
    video.defaultMuted = false;
    video.muted = false;
    video.playbackRate = playbackRate;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHlsSource && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = sourceUrl;
    } else if (isHlsSource && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(sourceUrl);
      hls.attachMedia(video);
    } else {
      video.src = sourceUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };
  }, [sourceUrl, preload, playbackRate, isHlsSource]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!active || blocked) {
      video.pause();
      setIsPaused(true);
      return;
    }

    attemptAutoplay();
  }, [active, blocked]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
      attemptAutoplay();
    };
    const handleTimeUpdate = () => {
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    };
    const handlePlay = () => {
      setIsPaused(false);
      setNeedUserStart(false);
    };
    const handlePause = () => {
      setIsPaused(true);
    };
    const handleCanPlay = () => {
      attemptAutoplay();
    };
    const handleError = () => {
      const mediaError = video.error;
      const codeMap = {
        1: '加载被中止',
        2: '网络错误',
        3: '解码失败',
        4: '资源不可用或地址无效',
      };
      const reason = mediaError?.code ? codeMap[mediaError.code] || '播放失败' : '播放失败';
      setPlayError(reason);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [active, blocked]);

  const togglePause = () => {
    const video = videoRef.current;
    if (!video || blocked) {
      return;
    }

    if (video.paused) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          setIsPaused(true);
        });
      }
    } else {
      video.pause();
    }
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      setShowSpeedSheet(true);
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    clearLongPress();
  };

  const handleTap = () => {
    if (showSpeedSheet) {
      setShowSpeedSheet(false);
      return;
    }

    togglePause();
  };

  const handleSeekChange = (event) => {
    const video = videoRef.current;
    if (!video || duration <= 0) {
      return;
    }

    const nextTime = Number(event.target.value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const applyPlaybackRate = (rate) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
    }
    setPlaybackRate(rate);
    setShowSpeedSheet(false);
  };

  useEffect(() => {
    return () => {
      clearLongPress();
      if (autoplayRetryTimerRef.current) {
        window.clearTimeout(autoplayRetryTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className="video-player"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleTap}
    >
      {preload ? (
        <video
          ref={videoRef}
          className="video-element"
          poster={poster}
          preload={active ? 'auto' : 'metadata'}
          autoPlay={active && !blocked}
          aria-label={title}
        />
      ) : (
        <img className="video-poster" src={poster} alt={title} loading="lazy" />
      )}

      {blocked && (
        <div className="lock-overlay" onClick={(event) => event.stopPropagation()}>
          <p>{lockLabel || '该内容需要解锁后观看'}</p>
          <button type="button" onClick={onUnlock}>立即解锁</button>
        </div>
      )}

      <button
        type="button"
        className={`play-overlay ${isPaused ? 'visible' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          togglePause();
        }}
        aria-label={isPaused ? '播放' : '暂停'}
      >
        {isPaused ? '▶' : '❚❚'}
      </button>

      {playError && (
        <div className="lock-overlay" onClick={(event) => event.stopPropagation()}>
          <p>视频播放失败：{playError}</p>
          <p style={{ fontSize: 12, opacity: 0.85, wordBreak: 'break-all' }}>{sourceUrl}</p>
        </div>
      )}

      {!playError && needUserStart && active && !blocked && (
        <div className="start-overlay">
          <button type="button" onClick={handleUserStart}>点击开始播放</button>
        </div>
      )}

      {showSpeedSheet && (
        <div className="speed-sheet" onClick={(event) => event.stopPropagation()}>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <button
              key={rate}
              type="button"
              className={playbackRate === rate ? 'active' : ''}
              onClick={() => applyPlaybackRate(rate)}
            >
              {rate}x
            </button>
          ))}
        </div>
      )}

      <div className="progress-wrap" onClick={(event) => event.stopPropagation()}>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={Math.min(currentTime, duration || 0)}
          step={0.01}
          onChange={handleSeekChange}
          className="progress-range"
        />
      </div>
    </div>
  );
};

export default React.memo(VideoPlayer);
