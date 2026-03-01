import React from 'react';

function SearchPage({
  searchQuery,
  setSearchQuery,
  setPage,
  searchSuggestions,
  searchHistory,
  setSearchHistory,
  hotKeywords,
  homeSearchResults,
  navigateToHomeVideo,
  formatCount,
}) {
  return (
    <section className="search-page">
      <div className="search-header">
        <input
          className="search-input"
          placeholder="搜索剧名 / 演员 / 关键词"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <button type="button" className="cancel-btn" onClick={() => setPage('home')}>
          取消
        </button>
      </div>

      {searchQuery.trim() && searchSuggestions.length > 0 && (
        <div className="suggestions">
          {searchSuggestions.map((word) => (
            <button key={word} type="button" onClick={() => setSearchQuery(word)}>
              {word}
            </button>
          ))}
        </div>
      )}

      {!searchQuery.trim() && (
        <>
          <div className="search-block">
            <div className="block-title">
              <h3>搜索历史</h3>
              <button type="button" onClick={() => setSearchHistory([])}>清空</button>
            </div>
            <div className="chips">
              {searchHistory.length === 0 ? (
                <p className="empty-note">暂无搜索历史</p>
              ) : (
                searchHistory.map((word) => (
                  <button key={word} type="button" onClick={() => setSearchQuery(word)}>{word}</button>
                ))
              )}
            </div>
          </div>

          <div className="search-block">
            <h3>热门搜索</h3>
            <div className="chips">
              {hotKeywords.map((word) => (
                <button key={word} type="button" onClick={() => setSearchQuery(word)}>{word}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {searchQuery.trim() && (
        <div className="result-grid">
          {homeSearchResults.length === 0 ? (
            <div className="empty-note">未找到相关短剧</div>
          ) : (
            homeSearchResults.map((video) => (
              <button
                key={video.id}
                type="button"
                className="result-card"
                onClick={() => navigateToHomeVideo(video.id, searchQuery)}
              >
                <img src={video.coverUrl} alt={video.title} loading="lazy" />
                <div className="result-meta">
                  <h4>{video.title}</h4>
                  <p>{video.actors[0] || '主演待更新'}</p>
                  <span>热度 {formatCount(video.views)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </section>
  );
}

export default React.memo(SearchPage);
