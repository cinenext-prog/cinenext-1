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
const seriesFreeEpisodesInput = document.querySelector('#series-free-episodes');
const seriesDescriptionInput = document.querySelector('#series-description');
const seriesActorsInput = document.querySelector('#series-actors');
const seriesResetBtn = document.querySelector('#series-reset');
const seriesStatus = document.querySelector('#series-status');

const uploadForm = document.querySelector('#upload-form');
const uploadSeriesSelect = document.querySelector('#upload-series-select');
const episodeNumberInput = document.querySelector('#episode-number');
const uploadFreeEpisodesInput = document.querySelector('#upload-free-episodes');
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
const queueSummary = document.querySelector('#queue-summary');
const queueList = document.querySelector('#queue-list');

const toast = document.querySelector('#toast');

let seriesDrafts = [];

const sortFilesByName = (files) =>
  [...files].sort((left, right) =>
    String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN', { numeric: true, sensitivity: 'base' })
  );

const getSelectedFiles = () => sortFilesByName(Array.from(uploadFileInput.files || []));

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

const renderQueuePreview = () => {
  const selectedSeries = findSelectedSeries();
  const files = getSelectedFiles();
  queueList.innerHTML = '';

  if (!selectedSeries || files.length === 0) {
    queueSummary.textContent = '当前未选择文件。';
    return;
  }

  const startEpisode = selectedSeries.nextEpisode;
  const endEpisode = startEpisode + files.length - 1;
  queueSummary.textContent = `本次将上传 ${files.length} 个文件：第 ${startEpisode} 集 ~ 第 ${endEpisode} 集`;

  files.slice(0, 30).forEach((file, index) => {
    const item = document.createElement('li');
    item.textContent = `第 ${startEpisode + index} 集 ← ${file.name}`;
    queueList.appendChild(item);
  });

  if (files.length > 30) {
    const more = document.createElement('li');
    more.textContent = `... 其余 ${files.length - 30} 个文件`;
    queueList.appendChild(more);
  }
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
      freeEpisodes: Math.max(0, Number(item.freeEpisodes || 0)),
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
    option.textContent = `${draft.seriesName}（总 ${draft.totalEpisodes} 集，前 ${draft.freeEpisodes} 集免费，当前第 ${draft.nextEpisode} 集）`;
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
    uploadFreeEpisodesInput.value = String(selected.freeEpisodes || 0);
    setSeriesStatus(
      `已选择《${selected.seriesName}》：总 ${selected.totalEpisodes} 集，前 ${selected.freeEpisodes || 0} 集免费，当前应上传第 ${selected.nextEpisode} 集。`
    );
  }
  renderQueuePreview();
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
  const episodeNumber = Math.max(1, Number(episodeNumberInput.value || 1));
  const freeEpisodes = Math.max(0, Number(uploadFreeEpisodesInput.value || 0));
  const selectedUnlockType = uploadUnlockTypeInput.value === 'nft' ? 'nft' : 'free';
  const isFreeEpisode = episodeNumber <= freeEpisodes;
  const unlockType = isFreeEpisode ? 'free' : selectedUnlockType;
  const price = isFreeEpisode ? '0' : String(uploadPriceInput.value || '0.5').trim();

  const metadata = {
    seriesName: series.seriesName,
    episodeNumber,
    totalEpisodes: series.totalEpisodes,
    freeEpisodes,
    isFreeEpisode,
    seriesDescription: series.description,
    actors: series.actors,
    unlockType,
    category: uploadCategoryInput.value.trim(),
    description: uploadDescriptionInput.value.trim(),
    nftCollectionAddress: unlockType === 'nft' ? uploadNftAddressInput.value.trim() : '',
    price,
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
    freeEpisodes: Math.max(0, Number(seriesFreeEpisodesInput.value || 0)),
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
  uploadFreeEpisodesInput.value = String(draft.freeEpisodes);

  showToast(existingIndex >= 0 ? '已更新剧信息' : '已新建剧信息');
  setSeriesStatus(`剧《${seriesName}》已保存：前 ${draft.freeEpisodes} 集免费，请在步骤 2 按顺序上传。`);
});

seriesResetBtn.addEventListener('click', () => {
  seriesForm.reset();
  seriesTotalEpisodesInput.value = '1';
  seriesFreeEpisodesInput.value = '0';
  setSeriesStatus('已清空步骤 1 表单。');
});

uploadSeriesSelect.addEventListener('change', () => {
  const selected = findSelectedSeries();
  if (!selected) {
    episodeNumberInput.value = '1';
    uploadFreeEpisodesInput.value = '0';
    renderQueuePreview();
    return;
  }
  episodeNumberInput.value = String(selected.nextEpisode);
  uploadFreeEpisodesInput.value = String(selected.freeEpisodes || 0);
  setSeriesStatus(
    `已选择《${selected.seriesName}》：总 ${selected.totalEpisodes} 集，前 ${selected.freeEpisodes || 0} 集免费，当前应上传第 ${selected.nextEpisode} 集。`
  );
  renderQueuePreview();
});

uploadFileInput.addEventListener('change', () => {
  renderQueuePreview();
});

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const files = getSelectedFiles();
  if (files.length === 0) {
    showToast('请至少选择一个视频文件', true);
    return;
  }

  const selectedSeries = findSelectedSeries();
  if (!selectedSeries) {
    showToast('请先在步骤 1 新建剧并选择该剧', true);
    return;
  }

  selectedSeries.freeEpisodes = Math.max(0, Number(uploadFreeEpisodesInput.value || 0));

  const startEpisode = Math.max(1, Number(episodeNumberInput.value || 1));
  if (startEpisode !== selectedSeries.nextEpisode) {
    showToast(`请按顺序上传：当前应上传第 ${selectedSeries.nextEpisode} 集`, true);
    episodeNumberInput.value = String(selectedSeries.nextEpisode);
    return;
  }

  if (selectedSeries.nextEpisode > selectedSeries.totalEpisodes) {
    showToast(`《${selectedSeries.seriesName}》已达到总集数，请先修改剧信息`, true);
    return;
  }

  if (startEpisode + files.length - 1 > selectedSeries.totalEpisodes) {
    showToast(
      `本次文件数量超出总集数：当前从第 ${startEpisode} 集开始，只剩 ${selectedSeries.totalEpisodes - startEpisode + 1} 集可上传`,
      true
    );
    return;
  }

  const namePrefix = uploadNameInput.value.trim();

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const episodeNumber = startEpisode + index;
      episodeNumberInput.value = String(episodeNumber);
      const metadata = buildMetadata(selectedSeries);
      const uploadName =
        files.length === 1 && namePrefix
          ? namePrefix
          : `${namePrefix || selectedSeries.seriesName} 第${episodeNumber}集`;

      setUploadProgress(`准备上传 ${index + 1}/${files.length}：第 ${episodeNumber} 集`);
      await requestUpload({ file, name: uploadName, metadata });
      selectedSeries.nextEpisode = episodeNumber + 1;
    }

    writeSeriesDrafts();
    updateSeriesSelect();
    uploadSeriesSelect.value = selectedSeries.seriesName;

    if (selectedSeries.nextEpisode > selectedSeries.totalEpisodes) {
      setSeriesStatus(`《${selectedSeries.seriesName}》已完成 ${selectedSeries.totalEpisodes} / ${selectedSeries.totalEpisodes} 集上传。`);
    } else {
      setSeriesStatus(
        `《${selectedSeries.seriesName}》本次已上传 ${files.length} 集（前 ${selectedSeries.freeEpisodes} 集免费），下一集为第 ${selectedSeries.nextEpisode} 集。`
      );
    }
    episodeNumberInput.value = String(selectedSeries.nextEpisode);
    setUploadProgress('上传完成，等待 Livepeer 处理...');
    showToast(`上传成功，共完成 ${files.length} 个文件`);

    uploadFileInput.value = '';
    uploadNameInput.value = '';
    renderQueuePreview();
  } catch (error) {
    setUploadProgress('上传失败。', true);
    showToast(error instanceof Error ? error.message : '上传失败', true);
  }
});

uploadResetBtn.addEventListener('click', () => {
  uploadForm.reset();
  uploadPriceInput.value = '0.5';
  uploadFreeEpisodesInput.value = findSelectedSeries() ? String(findSelectedSeries().freeEpisodes || 0) : '0';
  episodeNumberInput.value = findSelectedSeries() ? String(findSelectedSeries().nextEpisode) : '1';
  setUploadProgress('已清空上传表单。');
  renderQueuePreview();
});

const bootstrap = () => {
  const cachedKey = localStorage.getItem(API_KEY_STORAGE) || '';
  apiKeyInput.value = cachedKey;
  uploadPriceInput.value = '0.5';
  seriesFreeEpisodesInput.value = '0';
  uploadFreeEpisodesInput.value = '0';

  seriesDrafts = readSeriesDrafts();
  updateSeriesSelect();
  renderQueuePreview();

  if (!cachedKey) {
    setApiStatus('尚未连接。');
    return;
  }

  setApiStatus('已读取本地 API Key，可直接上传。');
};

bootstrap();
