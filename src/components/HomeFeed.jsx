import React, { useRef, useState } from 'react';
import VideoPlayer from './VideoPlayer';

const RENDER_RADIUS = 2;
const EPISODE_SWIPE_PX = 118;
const MIN_SWIPE_TIME_MS = 70;
const MAX_SWIPE_TIME_MS = 650;
const MAX_DRAG_PX = 180;

function HomeFeed({
  loading,
  videos,
  loadError,
  tonConnectUI,
  wallet,
  openSearch,
  feedRef,
  onFeedScroll,
  activeIndex,
  getInteraction,
  accessMap,
  adUnlocks,
  unlockingId,
  rewardingId,
  requestUnlock,
  watchAdToUnlock,
  toggleLike,
  openComment,
  shareVideo,
  reportPlaybackEvent,
  watchlist,
  toggleWatchlist,
  onSelectEpisode,
  onSelectRelativeEpisode,
  onNotInterested,
  onReportVideo,
  formatCount,
}) {
  const BrandLogo = () => (
    <svg viewBox="0 0 172 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cineGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF5A5F" />
          <stop offset="100%" stopColor="#B50F36" />
        </linearGradient>
      </defs>
      <rect x="0.8" y="1" width="30" height="30" rx="9" fill="url(#cineGrad)" />
      <path d="M7.3 24V8h3.2l7.1 9.6V8h3.1v16h-3.2l-7.1-9.7V24z" fill="#fff" />
      <path d="M18.2 12.4l7 3.6-7 3.6z" fill="#fff" opacity="0.96" />
      <text x="40" y="22.5" fill="#ffffff" fontSize="16" fontWeight="900" letterSpacing="1.1" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
        CINENEXT
      </text>
    </svg>
  );

  const WalletIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 8.2A2.2 2.2 0 0 1 6.2 6h10.4A2.2 2.2 0 0 1 18.8 8.2v.8H20a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1.2v.8A2.2 2.2 0 0 1 16.6 22H6.2A2.2 2.2 0 0 1 4 19.8V8.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.8 9H7a2 2 0 0 1 0-4h10.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="13.5" r="1.2" fill="currentColor" />
    </svg>
  );

  const SearchIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 16L20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchStartTimeRef = useRef(0);
  const [dragState, setDragState] = useState({
    seriesKey: '',
    offsetY: 0,
    dragging: false,
  });
  const [switchSignal, setSwitchSignal] = useState({ key: '', dir: 0, tick: 0 });

  const activeVideo = videos[activeIndex] || null;

  const triggerEpisodeSwipe = (deltaX, deltaY, durationMs) => {
    if (!activeVideo || !Array.isArray(activeVideo.episodes) || activeVideo.episodes.length <= 1) {
      return false;
    }

    if (durationMs < MIN_SWIPE_TIME_MS || durationMs > MAX_SWIPE_TIME_MS) {
      return false;
    }

    if (Math.abs(deltaY) < EPISODE_SWIPE_PX || Math.abs(deltaY) <= Math.abs(deltaX) * 1.25) {
      return false;
    }

    const currentIndex = activeVideo.episodes.findIndex((item) => item.id === activeVideo.selectedEpisodeId);
    if (currentIndex < 0) {
      return false;
    }

    if (deltaY < 0 && currentIndex < activeVideo.episodes.length - 1) {
      onSelectRelativeEpisode(activeVideo.seriesKey, activeVideo.selectedEpisodeId, 1);
      setSwitchSignal({ key: activeVideo.seriesKey, dir: 1, tick: Date.now() });
      return true;
    }

    if (deltaY > 0 && currentIndex > 0) {
      onSelectRelativeEpisode(activeVideo.seriesKey, activeVideo.selectedEpisodeId, -1);
      setSwitchSignal({ key: activeVideo.seriesKey, dir: -1, tick: Date.now() });
      return true;
    }

    return false;
  };

  const clampDrag = (deltaY) => {
    if (deltaY > MAX_DRAG_PX) return MAX_DRAG_PX;
    if (deltaY < -MAX_DRAG_PX) return -MAX_DRAG_PX;
    return deltaY;
  };

  const handleFeedTouchStart = (event) => {
    const point = event.changedTouches?.[0];
    if (!point) {
      return;
    }

    touchStartTimeRef.current = Date.now();
    touchStartRef.current = {
      x: point.clientX,
      y: point.clientY,
    };

    if (activeVideo?.seriesKey) {
      setDragState({
        seriesKey: activeVideo.seriesKey,
        offsetY: 0,
        dragging: true,
      });
    }
  };

  const handleFeedTouchMove = (event) => {
    const point = event.changedTouches?.[0];
    if (!point) {
      return;
    }

    const deltaX = point.clientX - touchStartRef.current.x;
    const deltaY = point.clientY - touchStartRef.current.y;
    const isEpisodeSwipeCandidate =
      Math.abs(deltaY) >= 10 &&
      Math.abs(deltaY) > Math.abs(deltaX) * 1.2;

    if (isEpisodeSwipeCandidate) {
      if (activeVideo?.seriesKey) {
        setDragState((prev) => ({
          seriesKey: activeVideo.seriesKey,
          offsetY: clampDrag(deltaY),
          dragging: true,
        }));
      }
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleFeedTouchEnd = (event) => {
    const point = event.changedTouches?.[0];
    if (!point) {
      return;
    }

    const deltaX = point.clientX - touchStartRef.current.x;
    const deltaY = point.clientY - touchStartRef.current.y;
    const durationMs = Math.max(0, Date.now() - touchStartTimeRef.current);

    if (activeVideo?.seriesKey) {
      setDragState((prev) => ({
        seriesKey: activeVideo.seriesKey,
        offsetY: 0,
        dragging: false,
      }));
    }

    triggerEpisodeSwipe(deltaX, deltaY, durationMs);
  };

  if (loading) {
    return <div className="state-view">加载中...</div>;
  }

  if (videos.length === 0) {
    return (
      <div className="state-view">
        <p>{loadError || '暂无视频内容'}</p>
      </div>
    );
  }

  return (
    <>
      <header className="home-topbar">
        <div className="brand-logo" aria-label="CineNext">
          <BrandLogo />
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className={`icon-btn ${wallet ? 'icon-btn-active' : ''}`}
            onClick={() => tonConnectUI.openModal()}
            aria-label={wallet ? '钱包已连接' : '连接钱包'}
            title={wallet ? '钱包已连接' : '连接钱包'}
          >
            <WalletIcon />
          </button>
          <button type="button" className="icon-btn" onClick={openSearch} aria-label="搜索">
            <SearchIcon />
          </button>
        </div>
      </header>

      <div
        className="feed-scroll"
        ref={feedRef}
        onScroll={onFeedScroll}
        onTouchStart={handleFeedTouchStart}
        onTouchMove={handleFeedTouchMove}
        onTouchEnd={handleFeedTouchEnd}
      >
        {videos.map((video, index) => {
          const shouldRenderHeavy = Math.abs(index - activeIndex) <= RENDER_RADIUS;
          const blocked = video.unlockType === 'nft' && !accessMap[video.id] && !adUnlocks[video.id];
          const lockLabel = wallet
            ? `需 NFT 解锁 · ${video.price} TON`
            : '连接钱包后解锁观看';

          if (!shouldRenderHeavy) {
            return (
              <section key={video.id} className="feed-item">
                <img className="video-poster" src={video.coverUrl} alt={video.title} loading="lazy" />
              </section>
            );
          }

          const interaction = getInteraction(video);

          return (
            <section key={video.id} className="feed-item">
              <VideoPlayer
                sourceUrl={video.playbackUrl}
                poster={video.coverUrl}
                title={video.seriesTitle || video.title}
                active={index === activeIndex}
                preload={true}
                blocked={blocked}
                lockLabel={unlockingId === video.id ? '解锁处理中...' : lockLabel}
                seriesButtonText={video.seriesSummary}
                episodes={video.episodes}
                selectedEpisodeId={video.selectedEpisodeId}
                switchDirection={switchSignal.key === video.seriesKey ? switchSignal.dir : 0}
                switchTick={switchSignal.key === video.seriesKey ? switchSignal.tick : 0}
                dragOffsetY={dragState.seriesKey === video.seriesKey ? dragState.offsetY : 0}
                isDraggingEpisode={dragState.seriesKey === video.seriesKey && dragState.dragging}
                onSelectEpisode={(episodeId) => onSelectEpisode(video.seriesKey, episodeId)}
                onNotInterested={() => onNotInterested(video)}
                onReport={() => onReportVideo(video)}
                onUnlock={() => requestUnlock(video)}
                onPlaybackEvent={(eventType, positionSeconds, payload) =>
                  reportPlaybackEvent(video, eventType, positionSeconds, payload)
                }
              />

              <div className="video-meta">
                <h2>{video.seriesTitle || video.title}</h2>
                <p>第 {video.episode} 集</p>
                <div className="meta-tags">
                  <span>热度 {formatCount(video.views)}</span>
                  <span>点赞 {formatCount(interaction.likes)}</span>
                  <span className={video.unlockType === 'nft' ? 'tag-lock' : 'tag-free'}>
                    {video.unlockType === 'nft' ? '需 NFT 解锁' : '免费'}
                  </span>
                </div>
              </div>

              <div className="video-actions" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => toggleLike(video)} className={interaction.liked ? 'active' : ''}>
                  ❤ {formatCount(interaction.likes)}
                </button>
                <button type="button" onClick={() => openComment(video)}>
                  💬 {formatCount(interaction.comments)}
                </button>
                <button type="button" onClick={() => shareVideo(video)}>
                  ↗ {formatCount(interaction.shares)}
                </button>
                {video.unlockType === 'nft' && !accessMap[video.id] && (
                  <button type="button" onClick={() => watchAdToUnlock(video)}>
                    {rewardingId === video.id ? '⏳ 广告中' : '🎬 广告解锁'}
                  </button>
                )}
                <button type="button" onClick={() => toggleWatchlist(video)}>
                  {watchlist.includes(video.id) ? '★ 已追' : '☆ 追剧'}
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export default React.memo(HomeFeed);
