const STORAGE_KEY = 'cinenext_videos';
const COMPAT_STORAGE_KEY = 'legacyVideos';

const form = document.querySelector('#video-form');
const titleInput = document.querySelector('#title');
const playbackIdInput = document.querySelector('#playbackId');
const playbackUrlInput = document.querySelector('#playbackUrl');
const episodeInput = document.querySelector('#episode');
const unlockTypeInput = document.querySelector('#unlockType');
const nftAddressInput = document.querySelector('#nftCollectionAddress');
const priceInput = document.querySelector('#price');
const actorsInput = document.querySelector('#actors');
const keywordsInput = document.querySelector('#keywords');

const tbody = document.querySelector('#video-tbody');
const table = document.querySelector('#video-table');
const emptyState = document.querySelector('#empty-state');
const toast = document.querySelector('#toast');

const resetFormBtn = document.querySelector('#reset-form');
const submitBtn = document.querySelector('#submit-btn');
const formTitle = document.querySelector('#form-title');
const refreshBtn = document.querySelector('#refresh-list');
const clearAllBtn = document.querySelector('#clear-all');
const exportBtn = document.querySelector('#export-json');
const importInput = document.querySelector('#import-json');

let editingId = '';

const safeParse = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const readList = () => {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(COMPAT_STORAGE_KEY);
  if (!raw) return [];
  const data = safeParse(raw, []);
  return Array.isArray(data) ? data : [];
};

const writeList = (list) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  localStorage.setItem(COMPAT_STORAGE_KEY, JSON.stringify(list));
};

const showToast = (text, isError = false) => {
  toast.textContent = text;
  toast.style.color = isError ? '#ff9d9d' : '#89d6a8';
  window.setTimeout(() => {
    if (toast.textContent === text) {
      toast.textContent = '';
    }
  }, 2200);
};

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const randomStat = (min, max) => Math.floor(min + Math.random() * (max - min));
const looksLikeLivepeerPlaybackId = (value) => /^[a-zA-Z0-9_-]{8,}$/.test(value);
const looksLikePlayableUrl = (value) => /^https:\/\/.+\.(m3u8|mp4)(\?.*)?$/i.test(value);

const toRow = (video, index) => {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${video.title || '-'}</td>
    <td>${video.episode || index + 1}</td>
    <td>${video.playbackId || '-'}</td>
    <td>${video.unlockType === 'nft' ? 'NFT' : '免费'}</td>
    <td class="actions-cell">
      <button type="button" class="secondary" data-action="edit" data-id="${video.id}">编辑</button>
      <button type="button" data-action="delete" data-id="${video.id}">删除</button>
    </td>
  `;
  return tr;
};

const resetFormState = () => {
  editingId = '';
  formTitle.textContent = '新增短剧';
  submitBtn.textContent = '添加到列表';
  resetFormBtn.textContent = '清空输入';

  form.reset();
  episodeInput.value = '1';
  priceInput.value = '0.5';
  unlockTypeInput.value = 'free';
  playbackUrlInput.value = '';
};

const startEdit = (video) => {
  editingId = String(video.id);
  formTitle.textContent = '编辑短剧';
  submitBtn.textContent = '保存修改';
  resetFormBtn.textContent = '取消编辑';

  titleInput.value = String(video.title || '');
  playbackIdInput.value = String(video.playbackId || '');
  playbackUrlInput.value = String(video.playbackUrl || '');
  episodeInput.value = String(Math.max(1, Number(video.episode || 1)));
  unlockTypeInput.value = video.unlockType === 'nft' ? 'nft' : 'free';
  nftAddressInput.value = String(video.nftCollectionAddress || '');
  priceInput.value = String(video.price || '0.5');
  actorsInput.value = Array.isArray(video.actors) ? video.actors.join(', ') : '';
  keywordsInput.value = Array.isArray(video.keywords) ? video.keywords.join(', ') : '';

  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const render = () => {
  const list = readList();
  tbody.innerHTML = '';

  if (list.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;
  list.forEach((video, index) => {
    tbody.appendChild(toRow(video, index));
  });
};

const buildVideo = () => {
  const title = titleInput.value.trim();
  const playbackId = playbackIdInput.value.trim();
  const playbackUrl = playbackUrlInput.value.trim();

  if (!title) {
    throw new Error('请填写剧名');
  }
  if (!playbackId) {
    throw new Error('请填写 Playback ID');
  }
  if (!looksLikeLivepeerPlaybackId(playbackId)) {
    throw new Error('Playback ID 格式不正确，请填写 Livepeer 真实 Playback ID（不要填 1/2/3）');
  }
  if (playbackUrl && !looksLikePlayableUrl(playbackUrl)) {
    throw new Error('播放地址格式不正确，请填写 https 开头的 m3u8/mp4 链接');
  }

  const unlockType = unlockTypeInput.value === 'nft' ? 'nft' : 'free';
  const episode = Math.max(1, Number(episodeInput.value || 1));

  return {
    id: `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    playbackId,
    playbackUrl: playbackUrl || `https://livepeercdn.com/hls/${playbackId}/index.m3u8`,
    unlockType,
    nftCollectionAddress: unlockType === 'nft' ? nftAddressInput.value.trim() : '',
    price: String(priceInput.value || '0.5'),
    actors: parseCsv(actorsInput.value),
    keywords: parseCsv(keywordsInput.value),
    episode,
    likes: randomStat(1000, 6000),
    views: randomStat(10000, 300000),
  };
};

form.addEventListener('submit', (event) => {
  event.preventDefault();

  try {
    const video = buildVideo();
    const list = readList();
    const conflict = list.some(
      (item) =>
        String(item.id) !== String(editingId) &&
        item.playbackId === video.playbackId &&
        Number(item.episode || 1) === Number(video.episode || 1)
    );

    if (conflict) {
      showToast('该 Playback ID + 集数 组合已存在', true);
      return;
    }

    const existingIndex = list.findIndex((item) => String(item.id) === String(editingId));
    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        ...video,
        id: list[existingIndex].id,
      };
    } else {
      list.unshift(video);
    }

    writeList(list);
    resetFormState();
    render();
    showToast(existingIndex >= 0 ? '已保存修改' : '已添加短剧');
  } catch (error) {
    showToast(error.message || '添加失败', true);
  }
});

tbody.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!id) return;

  const list = readList();

  if (action === 'edit') {
    const current = list.find((item) => String(item.id) === String(id));
    if (!current) {
      showToast('未找到要编辑的记录', true);
      return;
    }
    startEdit(current);
    return;
  }

  if (action !== 'delete') return;

  const next = list.filter((item) => item.id !== id);
  writeList(next);

  if (String(editingId) === String(id)) {
    resetFormState();
  }

  render();
  showToast('已删除');
});

resetFormBtn.addEventListener('click', () => {
  resetFormState();
});

refreshBtn.addEventListener('click', () => {
  render();
  showToast('已刷新');
});

clearAllBtn.addEventListener('click', () => {
  const ok = window.confirm('确认清空全部短剧吗？');
  if (!ok) return;
  writeList([]);
  resetFormState();
  render();
  showToast('已清空');
});

exportBtn.addEventListener('click', () => {
  const list = readList();
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cinenext_videos.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 JSON');
});

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = safeParse(text, null);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON 格式无效，必须是数组');
    }

    const normalized = parsed
      .map((item, index) => ({
        id: String(item.id || `legacy-import-${Date.now()}-${index}`),
        title: String(item.title || `短剧 ${index + 1}`),
        playbackId: String(item.playbackId || '').trim(),
        playbackUrl: String(item.playbackUrl || `https://livepeercdn.com/hls/${item.playbackId || ''}/index.m3u8`),
        unlockType: item.unlockType === 'nft' ? 'nft' : 'free',
        nftCollectionAddress: String(item.nftCollectionAddress || ''),
        price: String(item.price || '0.5'),
        actors: Array.isArray(item.actors) ? item.actors : [],
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        episode: Math.max(1, Number(item.episode || index + 1)),
        likes: Number(item.likes || randomStat(1000, 6000)),
        views: Number(item.views || randomStat(10000, 300000)),
      }))
      .filter((item) => item.playbackId);

    writeList(normalized);
    resetFormState();
    render();
    showToast('导入成功');
  } catch (error) {
    showToast(error.message || '导入失败', true);
  } finally {
    importInput.value = '';
  }
});

resetFormState();
render();
