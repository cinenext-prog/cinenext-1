import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import '../player.css';

const LONG_PRESS_MS = 450;

const VideoPlayer = ({
  sourceUrl,
  poster,
  title,
  active,
  preload,
  initialMuted,
  blocked,
  lockLabel,
  onUnlock,
  onMuteChange,
  onPlaybackState,
}) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const singleTapTimerRef = useRef(null);

  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [showSpeedSheet, setShowSpeedSheet] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setIsMuted(initialMuted);
  }, [initialMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourceUrl || !preload) {
      return;
    }

    video.loop = true;
    video.playsInline = true;
    video.defaultMuted = isMuted;
    video.muted = isMuted;
    video.playbackRate = playbackRate;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = sourceUrl;
    } else if (Hls.isSupported()) {
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
  }, [sourceUrl, preload, playbackRate, isMuted]);

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

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        setIsPaused(true);
      });
    }
  }, [active, blocked]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    };
    const handlePlay = () => {
      setIsPaused(false);
      onPlaybackState?.(true);
    };
    const handlePause = () => {
      setIsPaused(true);
      onPlaybackState?.(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [onPlaybackState]);

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

  const toggleMuted = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    onMuteChange?.(nextMuted);
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

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
      toggleMuted();
      return;
    }

    singleTapTimerRef.current = setTimeout(() => {
      togglePause();
      singleTapTimerRef.current = null;
    }, 230);
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
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
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

      <div className="muted-indicator">{isMuted ? '静音' : '有声'}</div>

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

export default VideoPlayer;
