import React from 'react';
import VideoPlayer from './VideoPlayer';

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
  unlockingId,
  requestUnlock,
  toggleLike,
  openComment,
  shareVideo,
  watchlist,
  toggleWatchlist,
  formatCount,
}) {
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

      <div className="feed-scroll" ref={feedRef} onScroll={onFeedScroll}>
        {videos.map((video, index) => {
          const interaction = getInteraction(video);
          const blocked = video.unlockType === 'nft' && !accessMap[video.id];
          const lockLabel = wallet
            ? `需 NFT 解锁 · ${video.price} TON`
            : '连接钱包后解锁观看';

          return (
            <section key={video.id} className="feed-item">
              <VideoPlayer
                sourceUrl={video.playbackUrl}
                poster={video.coverUrl}
                title={video.title}
                active={index === activeIndex}
                preload={Math.abs(index - activeIndex) <= 3}
                blocked={blocked}
                lockLabel={unlockingId === video.id ? '解锁处理中...' : lockLabel}
                onUnlock={() => requestUnlock(video)}
              />

              <div className="video-meta">
                <h2>{video.title}</h2>
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
