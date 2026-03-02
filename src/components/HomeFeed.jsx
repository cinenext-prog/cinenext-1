import React, { useRef } from 'react';
import VideoPlayer from './VideoPlayer';

const RENDER_RADIUS = 2;
const EPISODE_SWIPE_PX = 56;

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
  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchLockedRef = useRef(false);

  const activeVideo = videos[activeIndex] || null;

  const triggerEpisodeSwipe = (deltaX, deltaY) => {
    if (!activeVideo || !Array.isArray(activeVideo.episodes) || activeVideo.episodes.length <= 1) {
      return false;
    }

    if (Math.abs(deltaY) < EPISODE_SWIPE_PX || Math.abs(deltaY) <= Math.abs(deltaX)) {
      return false;
    }

    const currentIndex = activeVideo.episodes.findIndex((item) => item.id === activeVideo.selectedEpisodeId);
    if (currentIndex < 0) {
      return false;
    }

    if (deltaY < 0 && currentIndex < activeVideo.episodes.length - 1) {
      onSelectRelativeEpisode(activeVideo.seriesKey, activeVideo.selectedEpisodeId, 1);
      return true;
    }

    if (deltaY > 0 && currentIndex > 0) {
      onSelectRelativeEpisode(activeVideo.seriesKey, activeVideo.selectedEpisodeId, -1);
      return true;
    }

    return false;
  };

  const handleFeedTouchStart = (event) => {
    const point = event.changedTouches?.[0];
    if (!point) {
      return;
    }

    touchLockedRef.current = false;
    touchStartRef.current = {
      x: point.clientX,
      y: point.clientY,
    };
  };

  const handleFeedTouchMove = (event) => {
    if (touchLockedRef.current) {
      return;
    }

    const point = event.changedTouches?.[0];
    if (!point) {
      return;
    }

    const deltaX = point.clientX - touchStartRef.current.x;
    const deltaY = point.clientY - touchStartRef.current.y;
    const switched = triggerEpisodeSwipe(deltaX, deltaY);
    if (switched) {
      touchLockedRef.current = true;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleFeedTouchEnd = (event) => {
    if (touchLockedRef.current) {
      return;
    }

    const point = event.changedTouches?.[0];
    if (!point) {
      return;
    }

    const deltaX = point.clientX - touchStartRef.current.x;
    const deltaY = point.clientY - touchStartRef.current.y;
    triggerEpisodeSwipe(deltaX, deltaY);
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
        <div className="logo">CineNext</div>
        <div className="topbar-actions">
          <button type="button" className="wallet-btn" onClick={() => tonConnectUI.openModal()}>
            {wallet ? '钱包已连接' : '连接钱包'}
          </button>
          <button type="button" className="icon-btn" onClick={openSearch} aria-label="搜索">
            🔍
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
                onSelectEpisode={(episodeId) => onSelectEpisode(video.seriesKey, episodeId)}
                onSwipePrevEpisode={() => onSelectRelativeEpisode(video.seriesKey, video.selectedEpisodeId, -1)}
                onSwipeNextEpisode={() => onSelectRelativeEpisode(video.seriesKey, video.selectedEpisodeId, 1)}
                canSwipePrev={Array.isArray(video.episodes) && video.episodes.findIndex((item) => item.id === video.selectedEpisodeId) > 0}
                canSwipeNext={Array.isArray(video.episodes) && video.episodes.findIndex((item) => item.id === video.selectedEpisodeId) < (video.episodes.length - 1)}
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
