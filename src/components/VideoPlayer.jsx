import React from 'react';
import * as Player from '@livepeer/react/player';
import { getSrc } from '@livepeer/react/external';
import '../player.css';

const VideoPlayer = ({ playbackId }) => {
  if (!playbackId) {
    return (
      <div className="error">
        错误: 未提供视频 ID
      </div>
    );
  }

  return (
    <Player.Root
      src={getSrc(playbackId)}
      autoPlay
      muted={false}
    >
      <Player.Container>
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
          <Player.FullscreenTrigger />
        </Player.Controls>
        
        <Player.LoadingIndicator />
        <Player.ErrorIndicator />
      </Player.Container>
    </Player.Root>
  );
};

export default VideoPlayer;
