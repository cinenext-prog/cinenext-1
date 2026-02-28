import React, { useEffect, useState } from 'react';
import VideoPlayer from './components/VideoPlayer';

// 示例视频列表
const sampleVideos = [
  {
    id: 1,
    title: '示例视频 1',
    description: 'Livepeer 演示视频',
    playbackId: 'YOUR_PLAYBACK_ID_1', // 替换为你的 playbackId
  },
  {
    id: 2,
    title: '示例视频 2',
    description: '另一个演示视频',
    playbackId: 'YOUR_PLAYBACK_ID_2', // 替换为你的 playbackId
  },
];

function App() {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [tgUser, setTgUser] = useState(null);

  useEffect(() => {
    // 初始化 Telegram Web App
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // 扩展应用到全屏
      tg.expand();
      
      // 启用关闭确认
      tg.enableClosingConfirmation();
      
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
      
      // 根据是否选择视频显示/隐藏主按钮
      if (selectedVideo) {
        tg.MainButton.show();
      } else {
        tg.MainButton.hide();
      }
    }
    
    // 默认选择第一个视频
    if (!selectedVideo && sampleVideos.length > 0) {
      setSelectedVideo(sampleVideos[0]);
    }
  }, [selectedVideo]);

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
    
    // 提供触觉反馈（Telegram Mini App 特性）
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
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

        {selectedVideo ? (
          <div className="player-container">
            <VideoPlayer playbackId={selectedVideo.playbackId} />
          </div>
        ) : (
          <div className="loading">请选择一个视频</div>
        )}

        <div className="video-list">
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>视频列表</h2>
          {sampleVideos.map((video) => (
            <div
              key={video.id}
              className={`video-item ${selectedVideo?.id === video.id ? 'active' : ''}`}
              onClick={() => handleVideoSelect(video)}
            >
              <h3>{video.title}</h3>
              <p>{video.description}</p>
            </div>
          ))}
        </div>
      </div>
  );
}

export default App;
