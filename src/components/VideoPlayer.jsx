import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  seriesButtonText,
  episodes,
  selectedEpisodeId,
  switchDirection,
  switchTick,
  onSelectEpisode,
  onNotInterested,
  onReport,
  onUnlock,
  onPlaybackEvent,
}) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const autoplayRetryTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const timeRafRef = useRef(0);
  const pendingTimeRef = useRef(0);
  const lastProgressBucketRef = useRef(-1);

  const [isPaused, setIsPaused] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showEpisodeSheet, setShowEpisodeSheet] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [qualityMode, setQualityMode] = useState('720p');
  const [switchMotionClass, setSwitchMotionClass] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playError, setPlayError] = useState('');
  const [needUserStart, setNeedUserStart] = useState(false);
  const [resolvedSourceUrl, setResolvedSourceUrl] = useState(sourceUrl);
  const [hasSwitchedCdn, setHasSwitchedCdn] = useState(false);
  const switchMotionTimerRef = useRef(0);

  const isHlsSource = typeof resolvedSourceUrl === 'string' && /\.m3u8(\?|$)/i.test(resolvedSourceUrl);

  useEffect(() => {
    setResolvedSourceUrl(sourceUrl);
    setHasSwitchedCdn(false);
    setShowActionSheet(false);
    setShowEpisodeSheet(false);
  }, [sourceUrl]);

  useEffect(() => {
    if (!active || !switchDirection || !switchTick) {
      return;
    }

    if (switchMotionTimerRef.current) {
      window.clearTimeout(switchMotionTimerRef.current);
    }

    setSwitchMotionClass(switchDirection > 0 ? 'episode-switch-next' : 'episode-switch-prev');
    switchMotionTimerRef.current = window.setTimeout(() => {
      setSwitchMotionClass('');
      switchMotionTimerRef.current = 0;
    }, 260);
  }, [active, switchDirection, switchTick, selectedEpisodeId]);

  const switchToBackupCdn = useCallback(() => {
    const current = String(resolvedSourceUrl || '');
    if (!current || hasSwitchedCdn) {
      return false;
    }

    let next = '';
    if (current.includes('livepeercdn.com')) {
      next = current.replace('livepeercdn.com', 'livepeercdn.studio');
    } else if (current.includes('livepeercdn.studio')) {
      next = current.replace('livepeercdn.studio', 'livepeercdn.com');
    }

    if (!next || next === current) {
      return false;
    }

    setHasSwitchedCdn(true);
    setResolvedSourceUrl(next);
    setPlayError('当前线路不稳定，正在切换备用播放线路...');
    return true;
  }, [resolvedSourceUrl, hasSwitchedCdn]);

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
    if (!video || !resolvedSourceUrl || !preload) {
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
      video.src = resolvedSourceUrl;
    } else if (isHlsSource && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(resolvedSourceUrl);
      hls.attachMedia(video);
    } else {
      video.src = resolvedSourceUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [resolvedSourceUrl, preload, playbackRate, isHlsSource]);

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
      pendingTimeRef.current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      if (timeRafRef.current) {
        return;
      }

      timeRafRef.current = window.requestAnimationFrame(() => {
        timeRafRef.current = 0;
        setCurrentTime(pendingTimeRef.current);
      });
    };
    const handlePlay = () => {
      setIsPaused(false);
      setNeedUserStart(false);
      onPlaybackEvent?.('play', video.currentTime, { rate: video.playbackRate });
    };
    const handlePause = () => {
      setIsPaused(true);
      onPlaybackEvent?.('pause', video.currentTime, { rate: video.playbackRate });
    };
    const handleCanPlay = () => {
      attemptAutoplay();
    };
    const handleError = () => {
      if (switchToBackupCdn()) {
        return;
      }

      const mediaError = video.error;
      const codeMap = {
        1: '加载被中止',
        2: '网络错误',
        3: '解码失败',
        4: '资源不可用或地址无效',
      };
      const reason = mediaError?.code ? codeMap[mediaError.code] || '播放失败' : '播放失败';
      setPlayError(reason);
      onPlaybackEvent?.('error', video.currentTime, {
        code: mediaError?.code || null,
        reason,
        sourceUrl: resolvedSourceUrl,
      });
    };

    const handleEnded = () => {
      onPlaybackEvent?.('ended', video.currentTime, { duration: video.duration || 0 });
    };

    const handleProgressReport = () => {
      const seconds = Number.isFinite(video.currentTime) ? Math.floor(video.currentTime) : 0;
      const bucket = Math.floor(seconds / 15);
      if (bucket <= 0 || bucket === lastProgressBucketRef.current) {
        return;
      }

      lastProgressBucketRef.current = bucket;
      onPlaybackEvent?.('progress', seconds, {
        duration: Number.isFinite(video.duration) ? Math.floor(video.duration) : 0,
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleProgressReport);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleProgressReport);
      if (timeRafRef.current) {
        window.cancelAnimationFrame(timeRafRef.current);
        timeRafRef.current = 0;
      }
    };
  }, [active, blocked, onPlaybackEvent, switchToBackupCdn, resolvedSourceUrl]);

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
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setShowActionSheet(true);
      setShowEpisodeSheet(false);
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    clearLongPress();
  };

  const handleTap = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (showActionSheet || showEpisodeSheet) {
      setShowActionSheet(false);
      setShowEpisodeSheet(false);
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
    setShowActionSheet(false);
  };

  const applyQualityMode = (mode) => {
    const hls = hlsRef.current;
    if (hls && Array.isArray(hls.levels) && hls.levels.length > 0) {
      if (mode === '720p') {
        const candidates = hls.levels
          .map((item, idx) => ({ idx, height: Number(item?.height || 0) }))
          .filter((item) => item.height > 0)
          .sort((a, b) => a.height - b.height);
        if (candidates.length > 0) {
          const best = candidates.find((item) => item.height >= 720) || candidates[candidates.length - 1];
          hls.currentLevel = best.idx;
        }
      } else if (mode === '540p') {
        const candidates = hls.levels
          .map((item, idx) => ({ idx, height: Number(item?.height || 0) }))
          .filter((item) => item.height > 0)
          .sort((a, b) => a.height - b.height);
        if (candidates.length > 0) {
          const best = candidates.find((item) => item.height >= 540) || candidates[candidates.length - 1];
          hls.currentLevel = best.idx;
        }
      } else if (mode === '360p') {
        const candidates = hls.levels
          .map((item, idx) => ({ idx, height: Number(item?.height || 0) }))
          .filter((item) => item.height > 0)
          .sort((a, b) => a.height - b.height);
        if (candidates.length > 0) {
          const best = candidates.find((item) => item.height >= 360) || candidates[0];
          hls.currentLevel = best.idx;
        }
      }
    }

    setQualityMode(mode);
    setShowActionSheet(false);
  };

  useEffect(() => {
    return () => {
      clearLongPress();
      if (autoplayRetryTimerRef.current) {
        window.clearTimeout(autoplayRetryTimerRef.current);
      }
      if (switchMotionTimerRef.current) {
        window.clearTimeout(switchMotionTimerRef.current);
      }
      if (timeRafRef.current) {
        window.cancelAnimationFrame(timeRafRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`video-player ${switchMotionClass}`}
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

      {showActionSheet && (
        <div className="action-sheet-mask" onClick={() => setShowActionSheet(false)}>
          <div className="action-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="action-row">
              <div className="action-label">⚡ 倍速</div>
              <div className="action-chips">
                {[0.5, 0.75, 1, 1.5, 2].map((rate) => (
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
            </div>

            <div className="action-row">
              <div className="action-label">🎞 清晰度</div>
              <div className="action-chips">
                {['360p', '540p', '720p'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={qualityMode === mode ? 'active' : ''}
                    onClick={() => applyQualityMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="action-plain-btn"
              onClick={() => {
                setShowActionSheet(false);
                onNotInterested?.();
              }}
            >
              🙈 不感兴趣
            </button>
            <button
              type="button"
              className="action-plain-btn action-danger"
              onClick={() => {
                setShowActionSheet(false);
                onReport?.();
              }}
            >
              🚩 举报
            </button>
          </div>
        </div>
      )}

      {Array.isArray(episodes) && episodes.length > 0 && (
        <div className="series-entry-wrap" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="series-entry-btn"
            onClick={() => {
              setShowEpisodeSheet((prev) => !prev);
              setShowActionSheet(false);
            }}
          >
            {seriesButtonText || `全集${episodes.length}集`}
          </button>
        </div>
      )}

      {showEpisodeSheet && Array.isArray(episodes) && episodes.length > 0 && (
        <div className="episode-sheet" onClick={(event) => event.stopPropagation()}>
          {episodes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={selectedEpisodeId === item.id ? 'active' : ''}
              onClick={() => {
                setShowEpisodeSheet(false);
                onSelectEpisode?.(item.id);
              }}
            >
              第{item.episode}集
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
