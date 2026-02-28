import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'cinenext_videos';
const STORAGE_SELECTED_KEY = 'cinenext_selected_video_id';
const STORAGE_DRAFT_TITLE_KEY = 'cinenext_draft_title';
const STORAGE_DRAFT_PLAYBACK_KEY = 'cinenext_draft_playback_id';

const safeStorageGet = (key, fallback = '') => {
  try {
    const value = window.localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const safeStorageSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures in restricted WebViews
  }
};

const safeStorageRemove = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage failures in restricted WebViews
  }
};

const getTelegramWebApp = () => {
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    return null;
  }

  const hasInitData = typeof tg.initData === 'string' && tg.initData.length > 0;
  const isTelegramUA = /Telegram/i.test(window.navigator.userAgent || '');
  return hasInitData || isTelegramUA ? tg : null;
};

const extractPlaybackId = (rawInput) => {
  const input = rawInput.trim();
  if (!input) {
    return '';
  }

  if (/^[a-zA-Z0-9_-]+$/.test(input)) {
    return input;
  }

  try {
    const parsedUrl = new URL(input);
    const queryPlaybackId =
      parsedUrl.searchParams.get('playbackId') ||
      parsedUrl.searchParams.get('playback_id') ||
      parsedUrl.searchParams.get('playbackid');

    if (queryPlaybackId) {
      return queryPlaybackId;
    }

    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    const hlsIndex = segments.indexOf('hls');
    if (hlsIndex >= 0 && segments[hlsIndex + 1]) {
      return segments[hlsIndex + 1];
    }

    const webrtcIndex = segments.indexOf('webrtc');
    if (webrtcIndex >= 0 && segments[webrtcIndex + 1]) {
      return segments[webrtcIndex + 1];
    }
  } catch {
    return '';
  }

  return '';
};

function App() {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoTitle, setVideoTitle] = useState(() => safeStorageGet(STORAGE_DRAFT_TITLE_KEY, ''));
  const [videoPlaybackId, setVideoPlaybackId] = useState(() => safeStorageGet(STORAGE_DRAFT_PLAYBACK_KEY, ''));
  const [sourceError, setSourceError] = useState('');
  const [sourceHint, setSourceHint] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [tgUser, setTgUser] = useState(null);

  useEffect(() => {
    try {
      const savedVideos = safeStorageGet(STORAGE_KEY, '');
      const savedSelectedId = safeStorageGet(STORAGE_SELECTED_KEY, '');

      if (savedVideos) {
        const parsedVideos = JSON.parse(savedVideos);
        if (Array.isArray(parsedVideos)) {
          setVideos(parsedVideos);

          if (savedSelectedId) {
            const matchedVideo = parsedVideos.find((video) => String(video.id) === savedSelectedId);
            if (matchedVideo) {
              setSelectedVideo(matchedVideo);
            }
          }
        }
      }
    } catch {
      safeStorageRemove(STORAGE_KEY);
      safeStorageRemove(STORAGE_SELECTED_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      safeStorageSet(STORAGE_KEY, JSON.stringify(videos));
      if (selectedVideo?.id) {
        safeStorageSet(STORAGE_SELECTED_KEY, String(selectedVideo.id));
      }
    } catch {
      // 忽略本地存储异常
    }
  }, [videos, selectedVideo]);

  useEffect(() => {
    try {
      safeStorageSet(STORAGE_DRAFT_TITLE_KEY, videoTitle);
      safeStorageSet(STORAGE_DRAFT_PLAYBACK_KEY, videoPlaybackId);
    } catch {
      // 忽略本地存储异常
    }
  }, [videoTitle, videoPlaybackId]);

  useEffect(() => {
    // 初始化 Telegram Web App
    const tg = getTelegramWebApp();
    if (tg) {
      
      // 扩展应用到全屏
      tg.expand();
      
      // 获取用户信息
      if (tg.initDataUnsafe?.user) {
        setTgUser(tg.initDataUnsafe.user);
      }

      // 设置主按钮（可选）
      tg.MainButton.setText('分享视频');
      tg.MainButton.onClick(() => {
        if (selectedVideo) {
          tg.showAlert(`分享视频: ${selectedVideo.title}`);
        }
      });
    }
  }, []);

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (tg) {
      if (selectedVideo) {
        tg.MainButton.show();
      } else {
        tg.MainButton.hide();
      }
    }

    if (!selectedVideo && videos.length > 0) {
      setSelectedVideo(videos[0]);
    }
  }, [selectedVideo, videos]);

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
    setPlayerError('');
    
    // 提供触觉反馈（Telegram Mini App 特性）
    const tg = getTelegramWebApp();
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
  };

  const resolvePlaybackUrl = async (playbackId) => {
    const fallbackUrl = `https://livepeercdn.com/hls/${playbackId}/index.m3u8`;

    const resolveFromPlaybackApi = async () => {
      try {
        const playbackResponse = await fetch(`https://livepeer.studio/api/playback/${encodeURIComponent(playbackId)}`);
        if (!playbackResponse.ok) {
          return null;
        }

        const playbackData = await playbackResponse.json();
        const hlsSource = playbackData?.meta?.source?.find(
          (source) => source?.type === 'html5/application/vnd.apple.mpegurl' && typeof source?.url === 'string'
        );

        return hlsSource?.url || null;
      } catch {
        return null;
      }
    };

    try {
      const response = await fetch(`/api/playback-url?playbackId=${encodeURIComponent(playbackId)}`);
      if (!response.ok) {
        const publicUrl = await resolveFromPlaybackApi();
        return {
          playbackUrl: publicUrl || fallbackUrl,
          isSigned: false,
        };
      }

      const data = await response.json();
      if (typeof data.playbackUrl === 'string' && data.playbackUrl.length > 0) {
        return {
          playbackUrl: data.playbackUrl,
          isSigned: true,
        };
      }
    } catch {
      const publicUrl = await resolveFromPlaybackApi();
      return {
        playbackUrl: publicUrl || fallbackUrl,
        isSigned: false,
      };
    }

    const publicUrl = await resolveFromPlaybackApi();
    return {
      playbackUrl: publicUrl || fallbackUrl,
      isSigned: false,
    };
  };

  const handleAddVideo = async () => {

    const playbackId = extractPlaybackId(videoPlaybackId);
    const title = videoTitle.trim();
    if (!playbackId) {
      setSourceError('请输入有效的 playbackId，或粘贴包含 playbackId 的 Livepeer 播放链接。');
      setSourceHint('');
      return;
    }

    const duplicated = videos.some((video) => video.playbackId === playbackId);
    if (duplicated) {
      setSourceError('这个 playbackId 已添加过了。');
      setSourceHint('');
      return;
    }

    const tempId = Date.now();
    const defaultUrl = `https://livepeercdn.com/hls/${playbackId}/index.m3u8`;
    const newVideo = {
      id: tempId,
      title: title || `视频 ${videos.length + 1}`,
      description: `正在解析视频源 · ${playbackId}`,
      playbackId,
      playbackUrl: defaultUrl,
    };

    setSourceError('');
    setSourceHint('已添加到列表，正在解析可播放地址...');
    setPlayerError('');
    setVideos((prevVideos) => [newVideo, ...prevVideos]);
    setSelectedVideo(newVideo);
    setVideoPlaybackId('');
    setVideoTitle('');
    safeStorageRemove(STORAGE_DRAFT_TITLE_KEY);
    safeStorageRemove(STORAGE_DRAFT_PLAYBACK_KEY);

    setIsAddingVideo(true);
    try {
      const { playbackUrl, isSigned } = await resolvePlaybackUrl(playbackId);

      setVideos((prevVideos) =>
        prevVideos.map((video) =>
          video.id === tempId
            ? {
                ...video,
                playbackUrl,
                description: isSigned
                  ? `私有视频源 · ${playbackId}`
                  : `公开视频源 · ${playbackId}`,
              }
            : video
        )
      );
      setSelectedVideo((previous) =>
        previous?.id === tempId
          ? {
              ...previous,
              playbackUrl,
              description: isSigned
                ? `私有视频源 · ${playbackId}`
                : `公开视频源 · ${playbackId}`,
            }
          : previous
      );

      if (isSigned) {
        setSourceHint('已获取签名播放地址，正在播放私有视频。');
      } else {
        setSourceHint('已切换到公开视频播放地址。');
      }
    } finally {
      setIsAddingVideo(false);
    }
  };

  const handlePlaybackIdKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddVideo();
    }
  };

  return (
    <div className="container">
      <div className="header">
          <h1>🎥 Livepeer 视频播放器</h1>
          {tgUser && (
            <p style={{ marginTop: '8px', fontSize: '14px', opacity: 0.7 }}>
              欢迎, {tgUser.first_name}!
            </p>
          )}
        </div>

        <div className="source-form">
          <input
            className="source-input"
            placeholder="输入视频标题（可选）"
            value={videoTitle}
            onChange={(event) => setVideoTitle(event.target.value)}
          />
          <input
            className="source-input"
            placeholder="输入 playbackId，或粘贴播放链接（必填）"
            value={videoPlaybackId}
            onChange={(event) => setVideoPlaybackId(event.target.value)}
            onKeyDown={handlePlaybackIdKeyDown}
          />
          <button
            className="source-button"
            type="button"
            disabled={isAddingVideo}
            onClick={handleAddVideo}
          >
            {isAddingVideo ? '正在添加...' : '添加视频源'}
          </button>
          {sourceError && <p className="source-error">{sourceError}</p>}
          {sourceHint && <p className="source-hint">{sourceHint}</p>}
          {(videoTitle || videoPlaybackId) && (
            <p className="source-hint">已开启草稿保存，页面刷新后会自动恢复输入内容。</p>
          )}
        </div>

        <div className="video-list">
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>视频列表</h2>
          {videos.length === 0 ? (
            <div className="loading">暂无视频源，请先添加 playbackId</div>
          ) : (
            videos.map((video) => (
              <div
                key={video.id}
                className={`video-item ${selectedVideo?.id === video.id ? 'active' : ''}`}
                onClick={() => handleVideoSelect(video)}
              >
                <h3>{video.title}</h3>
                <p>{video.description}</p>
              </div>
            ))
          )}
        </div>

        {selectedVideo ? (
          <div className="player-container">
            <video
              className="native-player"
              controls
              autoPlay
              playsInline
              preload="metadata"
              src={selectedVideo.playbackUrl}
              onError={() => setPlayerError('播放器加载失败，请检查 playbackId 或稍后重试。')}
            />
            {playerError && <div className="error">{playerError}</div>}
          </div>
        ) : (
          <div className="loading">先添加一个 playbackId 开始播放</div>
        )}
      </div>
  );
}

export default App;
