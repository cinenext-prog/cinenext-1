const API_KEY_STORAGE = 'cinenext_livepeer_api_key';
const SERIES_DRAFTS_STORAGE = 'cinenext_series_drafts';
const LIVEPEER_API_BASE = 'https://livepeer.studio/api';

const apiKeyInput = document.querySelector('#api-key');
const saveKeyBtn = document.querySelector('#save-key');
const clearKeyBtn = document.querySelector('#clear-key');
const apiStatus = document.querySelector('#api-status');

const seriesForm = document.querySelector('#series-form');
const seriesNameInput = document.querySelector('#series-name');
const seriesTotalEpisodesInput = document.querySelector('#series-total-episodes');
const seriesDescriptionInput = document.querySelector('#series-description');
const seriesActorsInput = document.querySelector('#series-actors');
const seriesResetBtn = document.querySelector('#series-reset');
const seriesStatus = document.querySelector('#series-status');

const uploadForm = document.querySelector('#upload-form');
const uploadSeriesSelect = document.querySelector('#upload-series-select');
const episodeNumberInput = document.querySelector('#episode-number');
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

const toast = document.querySelector('#toast');

let seriesDrafts = [];

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

const setUploadProgress = (text, isError = false) => {
  uploadProgress.textContent = text;
  uploadProgress.style.color = isError ? '#ff9d9d' : '#97a2bb';
};

const setSeriesStatus = (text, isError = false) => {
  seriesStatus.textContent = text;
  seriesStatus.style.color = isError ? '#ff9d9d' : '#97a2bb';
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

const parseActors = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const readSeriesDrafts = () => {
  const raw = localStorage.getItem(SERIES_DRAFTS_STORAGE) || '[]';
  const parsed = safeParse(raw, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => ({
      seriesName: String(item.seriesName || '').trim(),
      totalEpisodes: Math.max(1, Number(item.totalEpisodes || 1)),
      description: String(item.description || ''),
      actors: Array.isArray(item.actors) ? item.actors : [],
      nextEpisode: Math.max(1, Number(item.nextEpisode || 1)),
    }))
    .filter((item) => item.seriesName);
};

const writeSeriesDrafts = () => {
  localStorage.setItem(SERIES_DRAFTS_STORAGE, JSON.stringify(seriesDrafts));
};

const updateSeriesSelect = () => {
  const currentValue = uploadSeriesSelect.value;
  uploadSeriesSelect.innerHTML = '';

  if (seriesDrafts.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '请先在步骤 1 新建剧';
    uploadSeriesSelect.appendChild(option);
    episodeNumberInput.value = '1';
    setSeriesStatus('还未创建剧信息。');
    return;
  }

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '请选择剧';
  uploadSeriesSelect.appendChild(placeholder);

  seriesDrafts.forEach((draft) => {
    const option = document.createElement('option');
    option.value = draft.seriesName;
    option.textContent = `${draft.seriesName}（总 ${draft.totalEpisodes} 集，当前第 ${draft.nextEpisode} 集）`;
    uploadSeriesSelect.appendChild(option);
  });

  if (seriesDrafts.some((item) => item.seriesName === currentValue)) {
    uploadSeriesSelect.value = currentValue;
  }

  if (!uploadSeriesSelect.value && seriesDrafts[0]) {
    uploadSeriesSelect.value = seriesDrafts[0].seriesName;
  }

  const selected = seriesDrafts.find((item) => item.seriesName === uploadSeriesSelect.value);
  if (selected) {
    episodeNumberInput.value = String(selected.nextEpisode);
    setSeriesStatus(`已选择《${selected.seriesName}》：总 ${selected.totalEpisodes} 集，当前应上传第 ${selected.nextEpisode} 集。`);
  }
};

const findSelectedSeries = () => seriesDrafts.find((item) => item.seriesName === uploadSeriesSelect.value);

const requestUpload = async ({ file, name, metadata }) => {
  const requestUploadResult = await requestLivepeer('/asset/request-upload', {
    method: 'POST',
    body: {
      name,
      metadata,
      corsOrigin: window.location.origin,
    },
  });

  const tusEndpoint = String(requestUploadResult?.tusEndpoint || '').trim();
  if (!tusEndpoint) {
    throw new Error('未获取到 tus 上传地址（tusEndpoint）');
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
      endpoint: tusEndpoint,
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

const buildMetadata = (series) => {
  const unlockType = uploadUnlockTypeInput.value === 'nft' ? 'nft' : 'free';
  const episodeNumber = Math.max(1, Number(episodeNumberInput.value || 1));

  const metadata = {
    seriesName: series.seriesName,
    episodeNumber,
    totalEpisodes: series.totalEpisodes,
    seriesDescription: series.description,
    actors: series.actors,
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

saveKeyBtn.addEventListener('click', () => {
  const key = readApiKey();
  if (!key) {
    showToast('请先输入 API Key', true);
    return;
  }
  localStorage.setItem(API_KEY_STORAGE, key);
  setApiStatus('API Key 已保存，可直接上传。');
  showToast('API Key 已保存到浏览器本地');
});

clearKeyBtn.addEventListener('click', () => {
  localStorage.removeItem(API_KEY_STORAGE);
  apiKeyInput.value = '';
  setApiStatus('API Key 已清除。');
  showToast('已清除 API Key');
});

seriesForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const seriesName = seriesNameInput.value.trim();
  const totalEpisodes = Math.max(1, Number(seriesTotalEpisodesInput.value || 1));

  if (!seriesName) {
    showToast('请填写剧名', true);
    return;
  }

  const draft = {
    seriesName,
    totalEpisodes,
    description: seriesDescriptionInput.value.trim(),
    actors: parseActors(seriesActorsInput.value),
    nextEpisode: 1,
  };

  const existingIndex = seriesDrafts.findIndex((item) => item.seriesName === seriesName);
  if (existingIndex >= 0) {
    seriesDrafts[existingIndex] = {
      ...seriesDrafts[existingIndex],
      ...draft,
      nextEpisode: seriesDrafts[existingIndex].nextEpisode,
    };
  } else {
    seriesDrafts.unshift(draft);
  }

  writeSeriesDrafts();
  updateSeriesSelect();
  uploadSeriesSelect.value = seriesName;
  episodeNumberInput.value = '1';

  showToast(existingIndex >= 0 ? '已更新剧信息' : '已新建剧信息');
  setSeriesStatus(`剧《${seriesName}》已保存，请在步骤 2 按顺序上传。`);
});

seriesResetBtn.addEventListener('click', () => {
  seriesForm.reset();
  seriesTotalEpisodesInput.value = '1';
  setSeriesStatus('已清空步骤 1 表单。');
});

uploadSeriesSelect.addEventListener('change', () => {
  const selected = findSelectedSeries();
  if (!selected) {
    episodeNumberInput.value = '1';
    return;
  }
  episodeNumberInput.value = String(selected.nextEpisode);
  setSeriesStatus(`已选择《${selected.seriesName}》：总 ${selected.totalEpisodes} 集，当前应上传第 ${selected.nextEpisode} 集。`);
});

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const file = uploadFileInput.files?.[0];
  if (!file) {
    showToast('请选择视频文件', true);
    return;
  }

  const selectedSeries = findSelectedSeries();
  if (!selectedSeries) {
    showToast('请先在步骤 1 新建剧并选择该剧', true);
    return;
  }

  const episodeNumber = Math.max(1, Number(episodeNumberInput.value || 1));
  if (episodeNumber !== selectedSeries.nextEpisode) {
    showToast(`请按顺序上传：当前应上传第 ${selectedSeries.nextEpisode} 集`, true);
    episodeNumberInput.value = String(selectedSeries.nextEpisode);
    return;
  }

  if (selectedSeries.nextEpisode > selectedSeries.totalEpisodes) {
    showToast(`《${selectedSeries.seriesName}》已达到总集数，请先修改剧信息`, true);
    return;
  }

  const uploadName = uploadNameInput.value.trim() || `${selectedSeries.seriesName} 第${episodeNumber}集`;

  try {
    const metadata = buildMetadata(selectedSeries);
    setUploadProgress('初始化上传...');
    await requestUpload({ file, name: uploadName, metadata });

    selectedSeries.nextEpisode += 1;
    writeSeriesDrafts();
    updateSeriesSelect();
    uploadSeriesSelect.value = selectedSeries.seriesName;

    if (selectedSeries.nextEpisode > selectedSeries.totalEpisodes) {
      setSeriesStatus(`《${selectedSeries.seriesName}》已完成 ${selectedSeries.totalEpisodes} / ${selectedSeries.totalEpisodes} 集上传。`);
    } else {
      setSeriesStatus(
        `《${selectedSeries.seriesName}》已上传第 ${episodeNumber} 集，下一集为第 ${selectedSeries.nextEpisode} 集。`
      );
    }
  episodeNumberInput.value = String(selectedSeries.nextEpisode);
    setUploadProgress('上传完成，等待 Livepeer 处理...');
    showToast('上传成功，可继续下一集');

    uploadFileInput.value = '';
    uploadNameInput.value = '';
  } catch (error) {
    setUploadProgress('上传失败。', true);
    showToast(error instanceof Error ? error.message : '上传失败', true);
  }
});

uploadResetBtn.addEventListener('click', () => {
  uploadForm.reset();
  uploadPriceInput.value = '0.5';
  episodeNumberInput.value = findSelectedSeries() ? String(findSelectedSeries().nextEpisode) : '1';
  setUploadProgress('已清空上传表单。');
});

const bootstrap = () => {
  const cachedKey = localStorage.getItem(API_KEY_STORAGE) || '';
  apiKeyInput.value = cachedKey;
  uploadPriceInput.value = '0.5';

  seriesDrafts = readSeriesDrafts();
  updateSeriesSelect();

  if (!cachedKey) {
    setApiStatus('尚未连接。');
    return;
  }

  setApiStatus('已读取本地 API Key，可直接上传。');
};

bootstrap();
