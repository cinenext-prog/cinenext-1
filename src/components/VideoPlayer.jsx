import React, { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import '../player.css';

const VideoPlayer = ({ playbackId, playbackUrl }) => {
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSpeedSheet, setShowSpeedSheet] = useState(false);
  const playerContainerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  const sourceUrl = useMemo(
    () => playbackUrl || `https://livepeercdn.com/hls/${playbackId}/index.m3u8`,
    [playbackId, playbackUrl]
  );

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !sourceUrl) {
      return;
    }

    videoElement.loop = true;
    videoElement.defaultMuted = false;
    videoElement.muted = false;
    videoElement.volume = 1;
    videoElement.playsInline = true;
    videoElement.playbackRate = playbackRate;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = sourceUrl;
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(sourceUrl);
      hls.attachMedia(videoElement);
    } else {
      videoElement.src = sourceUrl;
    }

    const tryPlay = () => {
      const playPromise = videoElement.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          setIsPaused(true);
        });
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(videoElement.duration) ? videoElement.duration : 0);
      setCurrentTime(Number.isFinite(videoElement.currentTime) ? videoElement.currentTime : 0);
      tryPlay();
    };

    const handleTimeUpdate = () => {
      setCurrentTime(Number.isFinite(videoElement.currentTime) ? videoElement.currentTime : 0);
    };

    const handlePlay = () => setIsPaused(false);
    const handlePause = () => setIsPaused(true);

    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);

    tryPlay();

    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      videoElement.removeAttribute('src');
      videoElement.load();
    };
  }, [sourceUrl, playbackRate]);

  if (!playbackId) {
    return (
      <div className="error">
        错误: 未提供视频 ID
      </div>
    );
  }

  const togglePlayPause = () => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    if (videoElement.paused) {
      const playPromise = videoElement.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // 忽略自动播放策略导致的异常
        });
      }
    } else {
      videoElement.pause();
    }
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePressStart = () => {
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setShowSpeedSheet(true);
    }, 450);
  };

  const handlePressEnd = () => {
    clearLongPressTimer();
  };

  const handleContainerClick = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    setShowSpeedSheet(false);
    togglePlayPause();
  };

  const applySpeed = (rate) => {
    setPlaybackRate(rate);
    setShowSpeedSheet(false);
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  useEffect(() => () => clearLongPressTimer(), []);

  return (
    <div
      className="native-player-root"
      ref={playerContainerRef}
      onPointerDown={handlePressStart}
      onPointerUp={handlePressEnd}
      onPointerCancel={handlePressEnd}
      onPointerLeave={handlePressEnd}
      onClick={handleContainerClick}
    >
      <video
        ref={videoRef}
        className="native-player-video"
        preload="auto"
        playsInline
      />

      <button
        type="button"
        className={`center-play-btn ${isPaused ? 'visible' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          togglePlayPause();
        }}
        aria-label={isPaused ? '播放视频' : '暂停视频'}
      >
        {isPaused ? '▶' : '❚❚'}
      </button>

      <div className="video-progress-bar" aria-hidden="true">
        <div className="video-progress-current" style={{ width: `${progressPercent}%` }} />
      </div>

      {showSpeedSheet && (
        <div
          className="speed-sheet"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-label="倍速选择"
        >
          {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <button
              key={rate}
              type="button"
              className={`speed-sheet-btn ${playbackRate === rate ? 'active' : ''}`}
              onClick={() => applySpeed(rate)}
            >
              {rate}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
