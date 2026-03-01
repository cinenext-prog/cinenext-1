const API_KEY_STORAGE = 'cinenext_livepeer_api_key';
const LIVEPEER_API_BASE = 'https://livepeer.studio/api';

const apiKeyInput = document.querySelector('#api-key');
const saveKeyBtn = document.querySelector('#save-key');
const connectBtn = document.querySelector('#connect-api');
const clearKeyBtn = document.querySelector('#clear-key');
const apiStatus = document.querySelector('#api-status');

const goUploadBtn = document.querySelector('#go-upload');
const searchInput = document.querySelector('#search-input');
const refreshBtn = document.querySelector('#refresh-list');
const emptyState = document.querySelector('#empty-state');
const seriesList = document.querySelector('#series-list');

const editPanel = document.querySelector('#edit-panel');
const editForm = document.querySelector('#edit-form');
const editIdInput = document.querySelector('#edit-id');
const editNameInput = document.querySelector('#edit-name');
const editSeriesNameInput = document.querySelector('#edit-series-name');
const editEpisodeNumberInput = document.querySelector('#edit-episode-number');
const editCancelBtn = document.querySelector('#edit-cancel');

const toast = document.querySelector('#toast');

let assets = [];
const expandedSeries = new Set();

const showToast = (text, isError = false) => {
  toast.textContent = text;
  toast.style.color = isError ? '#ff9d9d' : '#89d6a8';
  window.setTimeout(() => {
    if (toast.textContent === text) {
      toast.textContent = '';
    }
  }, 2600);
};

const readApiKey = () => apiKeyInput.value.trim();

const setApiStatus = (text, isError = false) => {
  apiStatus.textContent = text;
  apiStatus.style.color = isError ? '#ff9d9d' : '#97a2bb';
};

const toIsoTime = (value) => {
  if (!value) return '-';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '-';
  return `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(
    time.getDate()
  ).padStart(2, '0')} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
};

const parseEpisodeNumber = (value) => {
  const episode = Number(value);
  if (Number.isFinite(episode) && episode > 0) {
    return Math.floor(episode);
  }
  return 0;
};

const parseNameInfo = (name) => {
  const text = String(name || '').trim();
  const matched = text.match(/^(.*?)\s*第\s*(\d+)\s*集\s*(.*)$/i);

  if (!matched) {
    return {
      seriesName: text || '未分组剧名',
      episodeNumber: 9999,
    };
  }

  const seriesName = String(matched[1] || '').trim() || '未分组剧名';
  const episodeNumber = parseEpisodeNumber(matched[2]);

  return {
    seriesName,
    episodeNumber: episodeNumber > 0 ? episodeNumber : 9999,
  };
};

const buildEpisodeName = (seriesName, episodeNumber) => `${String(seriesName || '').trim()} 第${episodeNumber}集`;

const pickPlaybackId = (asset) => {
  if (asset.playbackId) return String(asset.playbackId);
  if (Array.isArray(asset.playbackIds) && asset.playbackIds[0]?.id) return String(asset.playbackIds[0].id);
  if (Array.isArray(asset.playbackIds) && typeof asset.playbackIds[0] === 'string') return asset.playbackIds[0];
  return '';
};

const playbackUrlFromId = (playbackId) => `https://livepeercdn.com/hls/${playbackId}/index.m3u8`;

const normalizeAsset = (asset) => {
  const name = String(asset.name || '未命名资源');
  const nameInfo = parseNameInfo(name);
  const playbackId = pickPlaybackId(asset);

  return {
    id: String(asset.id || ''),
    name,
    status: String(asset.status?.phase || asset.status || 'unknown'),
    createdAt: asset.createdAt || asset.created_at || '',
    playbackId,
    playbackUrl: playbackId ? playbackUrlFromId(playbackId) : '',
    seriesName: nameInfo.seriesName,
    episodeNumber: nameInfo.episodeNumber,
  };
};

const requestLivepeer = async (path, { method = 'GET', body } = {}) => {
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error('请先填写 API Key');
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${LIVEPEER_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const reason =
      parsed?.error ||
      parsed?.message ||
      parsed?.details ||
      (Array.isArray(parsed?.errors) && parsed.errors[0]) ||
      text ||
      `请求失败（HTTP ${response.status}）`;
    throw new Error(String(reason));
  }

  return parsed;
};

const toQueryString = (params) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const output = query.toString();
  return output ? `?${output}` : '';
};

const parseAssetPage = (payload) => {
  if (Array.isArray(payload)) {
    return { items: payload, nextCursor: '', hasNext: false };
  }

  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.assets)
      ? payload.assets
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  const nextCursor =
    payload?.nextCursor || payload?.next_cursor || payload?.meta?.nextCursor || payload?.meta?.next_cursor || '';

  const hasNext = Boolean(payload?.hasNextPage || payload?.hasNext || payload?.meta?.hasNextPage || nextCursor);

  return {
    items,
    nextCursor: String(nextCursor || ''),
    hasNext,
  };
};

const listAssets = async () => {
  const limit = 100;
  const maxPages = 50;
  const collected = [];

  let page = 1;
  let cursor = '';

  for (let index = 0; index < maxPages; index += 1) {
    const query = toQueryString({ limit, page, cursor });
    const payload = await requestLivepeer(`/asset${query}`);
    const parsed = parseAssetPage(payload);

    if (!parsed.items.length) break;

    collected.push(...parsed.items);

    if (parsed.nextCursor) {
      cursor = parsed.nextCursor;
      page += 1;
      continue;
    }

    if (parsed.items.length < limit || !parsed.hasNext) {
      break;
    }

    page += 1;
  }

  const unique = [];
  const seen = new Set();
  collected.forEach((item) => {
    const id = String(item?.id || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    unique.push(item);
  });

  return unique;
};

const clearEditForm = () => {
  editIdInput.value = '';
  editNameInput.value = '';
  editSeriesNameInput.value = '';
  editEpisodeNumberInput.value = '1';
  editPanel.hidden = true;
};

const groupBySeries = (list) => {
  const groups = new Map();
  list.forEach((asset) => {
    const key = String(asset.seriesName || '未分组剧名').trim() || '未分组剧名';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(asset);
  });

  return Array.from(groups.entries())
    .map(([seriesName, items]) => {
      const sortedItems = [...items].sort((left, right) => {
        if (left.episodeNumber !== right.episodeNumber) {
          return left.episodeNumber - right.episodeNumber;
        }
        return String(left.createdAt).localeCompare(String(right.createdAt));
      });

      return {
        seriesName,
        items: sortedItems,
        uploadedEpisodes: sortedItems.length,
      };
    })
    .sort((left, right) => left.seriesName.localeCompare(right.seriesName, 'zh-CN'));
};

const createEpisodeRow = (asset, index, total) => {
  const row = document.createElement('tr');

  const episodeTd = document.createElement('td');
  episodeTd.textContent = asset.episodeNumber >= 9999 ? '-' : String(asset.episodeNumber);

  const nameTd = document.createElement('td');
  nameTd.textContent = asset.name;

  const statusTd = document.createElement('td');
  statusTd.textContent = asset.status;

  const playbackTd = document.createElement('td');
  playbackTd.textContent = asset.playbackId || '-';

  const timeTd = document.createElement('td');
  timeTd.textContent = toIsoTime(asset.createdAt);

  const actionsTd = document.createElement('td');
  actionsTd.className = 'actions-cell';

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'secondary';
  playBtn.dataset.action = 'play';
  playBtn.dataset.id = asset.id;
  playBtn.textContent = '播放';
  playBtn.disabled = !asset.playbackUrl;

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'secondary';
  editBtn.dataset.action = 'edit';
  editBtn.dataset.id = asset.id;
  editBtn.textContent = '编辑';

  const upBtn = document.createElement('button');
  upBtn.type = 'button';
  upBtn.className = 'secondary';
  upBtn.dataset.action = 'move-up';
  upBtn.dataset.id = asset.id;
  upBtn.textContent = '上移';
  upBtn.disabled = index === 0;

  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.className = 'secondary';
  downBtn.dataset.action = 'move-down';
  downBtn.dataset.id = asset.id;
  downBtn.textContent = '下移';
  downBtn.disabled = index === total - 1;

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'danger';
  deleteBtn.dataset.action = 'delete';
  deleteBtn.dataset.id = asset.id;
  deleteBtn.textContent = '删除';

  actionsTd.append(playBtn, editBtn, upBtn, downBtn, deleteBtn);
  row.append(episodeTd, nameTd, statusTd, playbackTd, timeTd, actionsTd);

  return row;
};

const createSeriesCard = (group) => {
  const seriesKey = String(group.seriesName || '').trim() || '未分组剧名';
  const isExpanded = expandedSeries.has(seriesKey);

  const wrapper = document.createElement('article');
  wrapper.className = 'series-card';

  const header = document.createElement('div');
  header.className = 'series-header';

  const title = document.createElement('h3');
  title.textContent = group.seriesName;

  const badge = document.createElement('span');
  badge.className = 'series-badge';
  badge.textContent = `共 ${group.uploadedEpisodes} 集`;

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'secondary';
  toggleBtn.dataset.action = 'toggle-series';
  toggleBtn.dataset.series = seriesKey;
  toggleBtn.textContent = isExpanded ? '收起' : '展开';

  const right = document.createElement('div');
  right.className = 'series-actions';
  right.append(badge, toggleBtn);

  header.append(title, right);

  const body = document.createElement('div');
  body.className = 'series-body';
  body.hidden = !isExpanded;

  const table = document.createElement('table');
  table.className = 'table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['集数', '资源名称', '状态', 'Playback ID', '创建时间', '操作'].forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  group.items.forEach((asset, index) => {
    tbody.appendChild(createEpisodeRow(asset, index, group.items.length));
  });

  table.append(thead, tbody);
  body.append(table);
  wrapper.append(header, body);

  return wrapper;
};

const render = () => {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = assets.filter((asset) => {
    if (!query) return true;
    return (
      asset.name.toLowerCase().includes(query) ||
      asset.playbackId.toLowerCase().includes(query) ||
      asset.seriesName.toLowerCase().includes(query) ||
      String(asset.episodeNumber).includes(query)
    );
  });

  seriesList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.hidden = false;
    emptyState.textContent = assets.length === 0 ? '当前没有资产，请先连接后点击“上传视频”。' : '没有匹配的搜索结果。';
    return;
  }

  emptyState.hidden = true;

  const grouped = groupBySeries(filtered);
  grouped.forEach((group) => {
    seriesList.appendChild(createSeriesCard(group));
  });
};

const refreshAssets = async (showMessage = true) => {
  const list = await listAssets();
  assets = list.map(normalizeAsset);
  render();
  if (showMessage) {
    showToast(`已拉取 ${assets.length} 条资产`);
  }
  setApiStatus(`连接成功，当前资产数量：${assets.length}`);
};

const openEdit = (id) => {
  const target = assets.find((item) => item.id === id);
  if (!target) {
    showToast('未找到该资产', true);
    return;
  }

  editIdInput.value = target.id;
  editNameInput.value = target.name;
  editSeriesNameInput.value = target.seriesName || '';
  editEpisodeNumberInput.value = target.episodeNumber >= 9999 ? '1' : String(target.episodeNumber);
  editPanel.hidden = false;
  editPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const deleteAsset = async (id) => {
  const target = assets.find((item) => item.id === id);
  const confirmText = target ? `确认删除资源：${target.name}？` : '确认删除该资源？';
  const confirmed = window.confirm(confirmText);
  if (!confirmed) return;

  await requestLivepeer(`/asset/${encodeURIComponent(id)}`, { method: 'DELETE' });
  assets = assets.filter((item) => item.id !== id);
  render();
  clearEditForm();
  showToast('已删除资源');
};

const moveEpisode = async (id, direction) => {
  const current = assets.find((item) => item.id === id);
  if (!current) {
    throw new Error('未找到要调序的资源');
  }

  if (current.episodeNumber >= 9999) {
    throw new Error('该资源缺少有效集数，请先编辑后再调序');
  }

  const peers = assets
    .filter((item) => item.seriesName === current.seriesName)
    .sort((left, right) => left.episodeNumber - right.episodeNumber || String(left.createdAt).localeCompare(String(right.createdAt)));

  const currentIndex = peers.findIndex((item) => item.id === id);
  if (currentIndex < 0) {
    throw new Error('未找到剧集顺序');
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= peers.length) {
    return;
  }

  const target = peers[targetIndex];
  if (!target || target.episodeNumber >= 9999) {
    throw new Error('相邻资源缺少有效集数，无法调序');
  }

  const currentEpisode = current.episodeNumber;
  const targetEpisode = target.episodeNumber;

  const currentName = buildEpisodeName(current.seriesName, targetEpisode);
  const targetName = buildEpisodeName(target.seriesName, currentEpisode);

  await requestLivepeer(`/asset/${encodeURIComponent(current.id)}`, {
    method: 'PATCH',
    body: {
      name: currentName,
    },
  });

  await requestLivepeer(`/asset/${encodeURIComponent(target.id)}`, {
    method: 'PATCH',
    body: {
      name: targetName,
    },
  });

  assets = assets.map((item) => {
    if (item.id === current.id) {
      return {
        ...item,
        name: currentName,
        episodeNumber: targetEpisode,
      };
    }

    if (item.id === target.id) {
      return {
        ...item,
        name: targetName,
        episodeNumber: currentEpisode,
      };
    }

    return item;
  });

  render();
  showToast('已调整顺序');
};

saveKeyBtn.addEventListener('click', () => {
  const key = readApiKey();
  if (!key) {
    showToast('请先输入 API Key', true);
    return;
  }
  localStorage.setItem(API_KEY_STORAGE, key);
  showToast('API Key 已保存到浏览器本地');
});

clearKeyBtn.addEventListener('click', () => {
  localStorage.removeItem(API_KEY_STORAGE);
  apiKeyInput.value = '';
  assets = [];
  render();
  clearEditForm();
  setApiStatus('API Key 已清除。');
  showToast('已清除 API Key');
});

connectBtn.addEventListener('click', async () => {
  try {
    setApiStatus('连接中...');
    await refreshAssets();
  } catch (error) {
    const message = error instanceof Error ? error.message : '连接失败';
    if (message.includes('disallows CORS') || message.toLowerCase().includes('cors')) {
      setApiStatus('连接失败：该 API Key 未放行当前域名（CORS）。请到 Livepeer Key 设置里添加此域名。', true);
    } else if (message.includes('Failed to fetch')) {
      setApiStatus('连接失败：网络请求被拦截或超时，请检查网络/代理/浏览器插件。', true);
    } else {
      setApiStatus('连接失败，请检查 API Key 或网络。', true);
    }
    showToast(message, true);
  }
});

refreshBtn.addEventListener('click', async () => {
  try {
    await refreshAssets();
  } catch (error) {
    showToast(error instanceof Error ? error.message : '刷新失败', true);
  }
});

goUploadBtn.addEventListener('click', () => {
  window.location.href = 'upload.html';
});

searchInput.addEventListener('input', () => {
  render();
});

seriesList.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const { action, id, series } = target.dataset;
  if (!action) return;

  if (action === 'toggle-series') {
    const seriesKey = String(series || '').trim();
    if (!seriesKey) return;

    if (expandedSeries.has(seriesKey)) {
      expandedSeries.delete(seriesKey);
    } else {
      expandedSeries.add(seriesKey);
    }
    render();
    return;
  }

  if (!id) return;

  try {
    if (action === 'play') {
      const item = assets.find((asset) => asset.id === id);
      if (!item?.playbackUrl) {
        showToast('该资源暂无可用播放地址', true);
        return;
      }
      window.open(item.playbackUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (action === 'edit') {
      openEdit(id);
      return;
    }

    if (action === 'move-up') {
      await moveEpisode(id, 'up');
      return;
    }

    if (action === 'move-down') {
      await moveEpisode(id, 'down');
      return;
    }

    if (action === 'delete') {
      await deleteAsset(id);
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '操作失败', true);
  }
});

editCancelBtn.addEventListener('click', () => {
  clearEditForm();
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const id = editIdInput.value.trim();
  if (!id) {
    showToast('缺少 asset id', true);
    return;
  }

  const seriesName = editSeriesNameInput.value.trim();
  if (!seriesName) {
    showToast('剧名不能为空', true);
    return;
  }

  const episodeNumber = Math.max(1, Number(editEpisodeNumberInput.value || 1));
  const nextName = buildEpisodeName(seriesName, episodeNumber);

  try {
    await requestLivepeer(`/asset/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        name: nextName,
      },
    });

    showToast('已保存修改');
    clearEditForm();
    await refreshAssets(false);
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存失败', true);
  }
});

const bootstrap = async () => {
  const cachedKey = localStorage.getItem(API_KEY_STORAGE) || '';
  apiKeyInput.value = cachedKey;

  if (!cachedKey) {
    setApiStatus('尚未连接。');
    render();
    return;
  }

  setApiStatus('检测到本地 API Key，尝试自动连接...');
  try {
    await refreshAssets(false);
    showToast('已自动连接 Livepeer');
  } catch {
    setApiStatus('自动连接失败，请检查 API Key。', true);
  }
};

bootstrap();
