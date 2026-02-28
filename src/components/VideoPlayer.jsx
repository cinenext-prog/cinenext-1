import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Player from '@livepeer/react/player';
import { getSrc } from '@livepeer/react/external';
import '../player.css';

const VideoPlayer = ({ playbackId, playbackUrl }) => {
  const [playbackRate, setPlaybackRate] = useState(1);
  const playerContainerRef = useRef(null);

  useEffect(() => {
    const videoElement = playerContainerRef.current?.querySelector('[data-livepeer-video]');
    if (!videoElement) {
      return;
    }

    const applyPlaybackRate = () => {
      videoElement.playbackRate = playbackRate;
    };

    applyPlaybackRate();
    videoElement.addEventListener('loadedmetadata', applyPlaybackRate);

    return () => {
      videoElement.removeEventListener('loadedmetadata', applyPlaybackRate);
    };
  }, [playbackRate]);

  if (!playbackId) {
    return (
      <div className="error">
        错误: 未提供视频 ID
      </div>
    );
  }

  const source = useMemo(() => {
    try {
      const hlsUrl = playbackUrl || `https://livepeercdn.com/hls/${playbackId}/index.m3u8`;
      return getSrc(hlsUrl);
    } catch {
      return null;
    }
  }, [playbackId, playbackUrl]);

  if (!source) {
    return (
      <div className="error">
        错误: playbackId 无效，请检查后重试
      </div>
    );
  }

  return (
    <Player.Root
      src={source}
      autoPlay
      muted={false}
    >
      <Player.Container ref={playerContainerRef}>
        <Player.Video 
          title="Livepeer Video"
          style={{ width: '100%', height: 'auto' }}
        />
        
        <Player.Controls>
          <Player.PlayPauseTrigger />
          <Player.Time />
          <Player.Seek>
            <Player.Track>
              <Player.SeekBuffer />
              <Player.Range />
            </Player.Track>
            <Player.Thumb />
          </Player.Seek>
          <Player.Volume>
            <Player.VolumeIndicator />
          </Player.Volume>
          <select
            className="playback-rate-select"
            value={playbackRate}
            onChange={(event) => setPlaybackRate(Number(event.target.value))}
            aria-label="播放速度"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
          <Player.FullscreenTrigger />
        </Player.Controls>
        
        <Player.LoadingIndicator />
        <Player.ErrorIndicator />
      </Player.Container>
    </Player.Root>
  );
};

export default VideoPlayer;
