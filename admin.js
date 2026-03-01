const API_KEY_STORAGE = 'cinenext_livepeer_api_key';
const LIVEPEER_API_BASE = 'https://livepeer.studio/api';

const apiKeyInput = document.querySelector('#api-key');
const saveKeyBtn = document.querySelector('#save-key');
const connectBtn = document.querySelector('#connect-api');
const clearKeyBtn = document.querySelector('#clear-key');
const apiStatus = document.querySelector('#api-status');

const uploadForm = document.querySelector('#upload-form');
const uploadNameInput = document.querySelector('#upload-name');
const uploadFileInput = document.querySelector('#upload-file');
const uploadDescriptionInput = document.querySelector('#upload-description');
const uploadCategoryInput = document.querySelector('#upload-category');
const uploadUnlockTypeInput = document.querySelector('#upload-unlock-type');
const uploadNftAddressInput = document.querySelector('#upload-nft-address');
const uploadPriceInput = document.querySelector('#upload-price');
const uploadEncryptedInput = document.querySelector('#upload-encrypted');
const uploadMetadataJsonInput = document.querySelector('#upload-metadata-json');
const uploadResetBtn = document.querySelector('#upload-reset');
const uploadProgress = document.querySelector('#upload-progress');

const searchInput = document.querySelector('#search-input');
const refreshBtn = document.querySelector('#refresh-list');
const table = document.querySelector('#video-table');
const tbody = document.querySelector('#video-tbody');
const emptyState = document.querySelector('#empty-state');

const editPanel = document.querySelector('#edit-panel');
const editForm = document.querySelector('#edit-form');
const editIdInput = document.querySelector('#edit-id');
const editNameInput = document.querySelector('#edit-name');
const editMetadataJsonInput = document.querySelector('#edit-metadata-json');
const editCancelBtn = document.querySelector('#edit-cancel');

const toast = document.querySelector('#toast');

let assets = [];

const safeParse = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

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

const normalizeMetadata = (metadata) => {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    const parsed = safeParse(metadata, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata;
  }
  return {};
};

const pickPlaybackId = (asset) => {
  if (asset.playbackId) return String(asset.playbackId);
  if (Array.isArray(asset.playbackIds) && asset.playbackIds[0]?.id) return String(asset.playbackIds[0].id);
  if (Array.isArray(asset.playbackIds) && typeof asset.playbackIds[0] === 'string') return asset.playbackIds[0];
  return '';
};

const normalizeAsset = (asset) => {
  const metadata = normalizeMetadata(asset.metadata);
  return {
    id: String(asset.id || ''),
    name: String(asset.name || '未命名资源'),
    status: String(asset.status?.phase || asset.status || 'unknown'),
    createdAt: asset.createdAt || asset.created_at || '',
    playbackId: pickPlaybackId(asset),
    metadata,
    raw: asset,
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
  const parsed = safeParse(text, null);

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

const toMetaPreview = (metadata) => {
  const values = [];
  const keys = ['unlockType', 'nftCollectionAddress', 'price', 'category'];
  keys.forEach((key) => {
    if (metadata?.[key] !== undefined && metadata?.[key] !== '') {
      values.push(`${key}: ${metadata[key]}`);
    }
  });
  if (values.length === 0) {
    return '-';
  }
  return values.join(' | ');
};

const setUploadProgress = (text, isError = false) => {
  uploadProgress.textContent = text;
  uploadProgress.style.color = isError ? '#ff9d9d' : '#97a2bb';
};

const clearEditForm = () => {
  editIdInput.value = '';
  editNameInput.value = '';
  editMetadataJsonInput.value = '';
  editPanel.hidden = true;
};

const buildMetadataFromUploadForm = () => {
  const unlockType = uploadUnlockTypeInput.value === 'nft' ? 'nft' : 'free';
  const metadata = {
    unlockType,
    category: uploadCategoryInput.value.trim(),
    description: uploadDescriptionInput.value.trim(),
    nftCollectionAddress: unlockType === 'nft' ? uploadNftAddressInput.value.trim() : '',
    price: String(uploadPriceInput.value || '0.5').trim(),
  };

  const extras = safeParse(uploadMetadataJsonInput.value.trim() || '{}', null);
  if (extras === null || typeof extras !== 'object' || Array.isArray(extras)) {
    throw new Error('额外 metadata 必须是 JSON 对象');
  }

  Object.entries(extras).forEach(([key, value]) => {
    metadata[key] = value;
  });

  return metadata;
};

const uploadByTus = async ({ file, name, metadata }) => {
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error('请先填写 API Key');
  }

  const tusModule = await import('https://esm.sh/tus-js-client@4.3.1');
  const tus = tusModule.default || tusModule;

  const uploadMetadata = {
    filename: file.name,
    filetype: file.type || 'video/mp4',
    name,
    encrypted: uploadEncryptedInput.checked ? 'true' : 'false',
  };

  Object.entries(metadata).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    uploadMetadata[key] = typeof value === 'string' ? value : JSON.stringify(value);
  });

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${LIVEPEER_API_BASE}/asset/upload/direct`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      retryDelays: [0, 1000, 3000, 5000],
      metadata: uploadMetadata,
      onError: (error) => {
        reject(error instanceof Error ? error : new Error('上传失败'));
      },
      onProgress: (uploaded, total) => {
        const progress = total > 0 ? ((uploaded / total) * 100).toFixed(1) : '0.0';
        setUploadProgress(`上传中：${progress}%`);
      },
      onSuccess: () => {
        resolve({ uploadUrl: upload.url || '' });
      },
    });

    upload.start();
  });
};

const render = () => {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = assets.filter((item) => {
    if (!query) return true;
    return item.name.toLowerCase().includes(query) || item.playbackId.toLowerCase().includes(query);
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    emptyState.textContent = assets.length === 0 ? '当前没有资产，请先连接并上传。' : '没有匹配的搜索结果。';
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;

  filtered.forEach((asset) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = asset.name;

    const statusTd = document.createElement('td');
    statusTd.textContent = asset.status;

    const playbackTd = document.createElement('td');
    playbackTd.textContent = asset.playbackId || '-';

    const timeTd = document.createElement('td');
    timeTd.textContent = toIsoTime(asset.createdAt);

    const metadataTd = document.createElement('td');
    metadataTd.textContent = toMetaPreview(asset.metadata);

    const actionsTd = document.createElement('td');
    actionsTd.className = 'actions-cell';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'secondary';
    editBtn.dataset.action = 'edit';
    editBtn.dataset.id = asset.id;
    editBtn.textContent = '编辑';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'danger';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.dataset.id = asset.id;
    deleteBtn.textContent = '删除';

    actionsTd.append(editBtn, deleteBtn);
    tr.append(nameTd, statusTd, playbackTd, timeTd, metadataTd, actionsTd);
    tbody.appendChild(tr);
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
  editMetadataJsonInput.value = JSON.stringify(target.metadata || {}, null, 2);
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

searchInput.addEventListener('input', () => {
  render();
});

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = uploadFileInput.files?.[0];

  if (!file) {
    showToast('请选择视频文件', true);
    return;
  }

  const name = uploadNameInput.value.trim();
  if (!name) {
    showToast('请输入资源名称', true);
    return;
  }

  try {
    const metadata = buildMetadataFromUploadForm();
    setUploadProgress('初始化上传...');
    await uploadByTus({ file, name, metadata });
    setUploadProgress('上传完成，正在等待 Livepeer 处理...');
    showToast('上传成功，请稍等后刷新列表');

    uploadForm.reset();
    uploadPriceInput.value = '0.5';

    window.setTimeout(async () => {
      try {
        await refreshAssets(false);
        setUploadProgress('已刷新列表。');
      } catch {
        setUploadProgress('上传成功，自动刷新失败，请手动点击“刷新列表”。', true);
      }
    }, 1800);
  } catch (error) {
    setUploadProgress('上传失败。', true);
    showToast(error instanceof Error ? error.message : '上传失败', true);
  }
});

uploadResetBtn.addEventListener('click', () => {
  uploadForm.reset();
  uploadPriceInput.value = '0.5';
  setUploadProgress('已清空上传表单。');
});

tbody.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const { action, id } = target.dataset;
  if (!action || !id) return;

  try {
    if (action === 'edit') {
      openEdit(id);
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

  const name = editNameInput.value.trim();
  if (!name) {
    showToast('资源名称不能为空', true);
    return;
  }

  const metadata = safeParse(editMetadataJsonInput.value.trim() || '{}', null);
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    showToast('metadata 必须是 JSON 对象', true);
    return;
  }

  try {
    await requestLivepeer(`/asset/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        name,
        metadata,
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
  uploadPriceInput.value = '0.5';

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
