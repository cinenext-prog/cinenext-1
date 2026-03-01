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
const seriesPricePerEpisodeInput = document.querySelector('#series-price-per-episode');
const seriesDescriptionInput = document.querySelector('#series-description');
const seriesActorsInput = document.querySelector('#series-actors');
const seriesResetBtn = document.querySelector('#series-reset');
const seriesStatus = document.querySelector('#series-status');

const uploadForm = document.querySelector('#upload-form');
const uploadSeriesSelect = document.querySelector('#upload-series-select');
const episodeNumberInput = document.querySelector('#episode-number');
const uploadFileInput = document.querySelector('#upload-file');
const uploadResetBtn = document.querySelector('#upload-reset');
const uploadProgress = document.querySelector('#upload-progress');
const queueSummary = document.querySelector('#queue-summary');
const queueList = document.querySelector('#queue-list');

const toast = document.querySelector('#toast');

let seriesDrafts = [];
let uploadQueue = [];

const clearUploadQueue = () => {
  uploadQueue.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
  uploadQueue = [];
};

const setUploadQueueFromFiles = (files) => {
  clearUploadQueue();
  uploadQueue = Array.from(files || []).map((file) => ({
    file,
    previewUrl: URL.createObjectURL(file),
  }));
};

const getQueueFiles = () => uploadQueue.map((item) => item.file);

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
  }, isError ? 8000 : 2600);
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
  const files = getQueueFiles();
  queueList.innerHTML = '';

  if (!selectedSeries || files.length === 0) {
    queueSummary.textContent = '当前未选择文件。';
    return;
  }

  const startEpisode = selectedSeries.nextEpisode;
  const endEpisode = startEpisode + files.length - 1;
  queueSummary.textContent = `本次将上传 ${files.length} 个文件：第 ${startEpisode} 集 ~ 第 ${endEpisode} 集`;

  files.forEach((file, index) => {
    const item = document.createElement('li');
    item.className = 'queue-item';

    const thumb = document.createElement('img');
    thumb.className = 'queue-thumb';
    thumb.src = uploadQueue[index]?.previewUrl || '';
    thumb.alt = `预览 ${file.name}`;

    const info = document.createElement('div');
    info.className = 'queue-info';

    const title = document.createElement('strong');
    title.textContent = `第 ${startEpisode + index} 集`;

    const name = document.createElement('span');
    name.textContent = file.name;

    const actions = document.createElement('div');
    actions.className = 'queue-actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'secondary';
    upBtn.textContent = '上移';
    upBtn.dataset.action = 'up';
    upBtn.dataset.index = String(index);
    upBtn.disabled = index === 0;

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'secondary';
    downBtn.textContent = '下移';
    downBtn.dataset.action = 'down';
    downBtn.dataset.index = String(index);
    downBtn.disabled = index === files.length - 1;

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    info.appendChild(title);
    info.appendChild(name);
    info.appendChild(actions);
    item.appendChild(thumb);
    item.appendChild(info);
    queueList.appendChild(item);
  });
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
      pricePerEpisode: Math.max(0, Number(item.pricePerEpisode ?? 0.5)),
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
    option.textContent = `${draft.seriesName}（总 ${draft.totalEpisodes} 集，前 ${draft.freeEpisodes} 集免费，每集 ${draft.pricePerEpisode} TON，当前第 ${draft.nextEpisode} 集）`;
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
    setSeriesStatus(
      `已选择《${selected.seriesName}》：总 ${selected.totalEpisodes} 集，前 ${selected.freeEpisodes || 0} 集免费，每集 ${selected.pricePerEpisode} TON，当前应上传第 ${selected.nextEpisode} 集。`
    );
  }
  renderQueuePreview();
};

const findSelectedSeries = () => seriesDrafts.find((item) => item.seriesName === uploadSeriesSelect.value);

const requestUpload = async ({ file, name, metadata }) => {
  setUploadProgress('正在向 Livepeer 申请上传地址...');
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

  const tusUrl = String(requestUploadResult?.url || '').trim();

  const tusModule = await import('https://esm.sh/tus-js-client@4.3.1');
  const tus = tusModule.default || tusModule;

  const uploadMetadata = {
    filename: file.name,
    filetype: file.type || 'video/mp4',
    name,
  };

  Object.entries(metadata).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    uploadMetadata[key] = typeof value === 'string' ? value : JSON.stringify(value);
  });

  const getTusErrorMessage = (error) => {
    if (!error) return '上传失败';
    const originalError = error?.originalRequest?.getUnderlyingObject?.()?.responseText;
    const message = error instanceof Error ? error.message : String(error);
    const status =
      error?.originalResponse?.getStatus?.() ||
      error?.originalRequest?.getStatus?.() ||
      error?.status ||
      null;

    let body = '';
    try {
      body = error?.originalResponse?.getBody?.() || originalError || error?.responseText || '';
    } catch {
      body = originalError || '';
    }

    if (status && body) return `${message}（HTTP ${status}: ${String(body).slice(0, 240)}）`;
    if (status) return `${message}（HTTP ${status}）`;
    if (body) return `${message}（${String(body).slice(0, 240)}）`;
    return message;
  };

  const runTusUpload = (mode) =>
    new Promise((resolve, reject) => {
      let upload;
      const options = {
        retryDelays: [0, 1000, 3000, 5000],
        metadata: uploadMetadata,
        onError: (error) => {
          reject(new Error(getTusErrorMessage(error)));
        },
        onProgress: (uploaded, total) => {
          const progress = total > 0 ? ((uploaded / total) * 100).toFixed(1) : '0.0';
          setUploadProgress(`上传中：${progress}%`);
        },
        onSuccess: () => {
          resolve({ uploadUrl: upload.url || '' });
        },
      };

      if (mode === 'uploadUrl' && tusUrl) {
        options.uploadUrl = tusUrl;
        setUploadProgress('正在使用备用上传通道...');
      } else {
        options.endpoint = tusEndpoint;
        setUploadProgress('正在建立上传会话...');
      }

      upload = new tus.Upload(file, options);
      upload.start();
    });

  try {
    return await runTusUpload('endpoint');
  } catch (endpointError) {
    if (!tusUrl) {
      throw new Error(`主通道上传失败：${endpointError.message}`);
    }
    setUploadProgress('endpoint 上传失败，尝试备用上传方式...');
    try {
      return await runTusUpload('uploadUrl');
    } catch (uploadUrlError) {
      throw new Error(`主通道与备用通道均失败：${uploadUrlError.message}`);
    }
  }
};

const buildMetadata = (series, episodeNumber) => {
  const freeEpisodes = Math.max(0, Number(series.freeEpisodes || 0));
  const isFreeEpisode = episodeNumber <= freeEpisodes;
  const price = isFreeEpisode ? '0' : String(Math.max(0, Number(series.pricePerEpisode ?? 0.5)));

  const metadata = {
    seriesName: series.seriesName,
    episodeNumber,
    totalEpisodes: series.totalEpisodes,
    freeEpisodes,
    isFreeEpisode,
    seriesDescription: series.description,
    actors: series.actors,
    unlockType: isFreeEpisode ? 'free' : 'paid',
    price,
  };

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
    pricePerEpisode: Math.max(0, Number(seriesPricePerEpisodeInput.value || 0)),
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
  setSeriesStatus(
    `剧《${seriesName}》已保存：前 ${draft.freeEpisodes} 集免费，每集 ${draft.pricePerEpisode} TON，请在步骤 2 按顺序上传。`
  );
});

seriesResetBtn.addEventListener('click', () => {
  seriesForm.reset();
  seriesTotalEpisodesInput.value = '1';
  seriesFreeEpisodesInput.value = '0';
  seriesPricePerEpisodeInput.value = '0.5';
  setSeriesStatus('已清空步骤 1 表单。');
});

uploadSeriesSelect.addEventListener('change', () => {
  const selected = findSelectedSeries();
  if (!selected) {
    episodeNumberInput.value = '1';
    renderQueuePreview();
    return;
  }
  episodeNumberInput.value = String(selected.nextEpisode);
  setSeriesStatus(
    `已选择《${selected.seriesName}》：总 ${selected.totalEpisodes} 集，前 ${selected.freeEpisodes || 0} 集免费，每集 ${selected.pricePerEpisode} TON，当前应上传第 ${selected.nextEpisode} 集。`
  );
  renderQueuePreview();
});

uploadFileInput.addEventListener('change', () => {
  setUploadQueueFromFiles(uploadFileInput.files || []);
  renderQueuePreview();
});

queueList.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const action = target.dataset.action;
  const index = Number(target.dataset.index || -1);
  if (!Number.isInteger(index) || index < 0 || index >= uploadQueue.length) return;

  if (action === 'up' && index > 0) {
    [uploadQueue[index - 1], uploadQueue[index]] = [uploadQueue[index], uploadQueue[index - 1]];
    renderQueuePreview();
    return;
  }

  if (action === 'down' && index < uploadQueue.length - 1) {
    [uploadQueue[index], uploadQueue[index + 1]] = [uploadQueue[index + 1], uploadQueue[index]];
    renderQueuePreview();
  }
});

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const files = getQueueFiles();
  if (files.length === 0) {
    showToast('请至少选择一个视频文件', true);
    return;
  }

  const selectedSeries = findSelectedSeries();
  if (!selectedSeries) {
    showToast('请先在步骤 1 新建剧并选择该剧', true);
    return;
  }

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

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const episodeNumber = startEpisode + index;
      episodeNumberInput.value = String(episodeNumber);
      const metadata = buildMetadata(selectedSeries, episodeNumber);
      const uploadName = `${selectedSeries.seriesName} 第${episodeNumber}集`;

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
    clearUploadQueue();
    renderQueuePreview();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error || '上传失败');
    setUploadProgress(`上传失败：${errorMessage}`, true);
    showToast(`上传失败：${errorMessage}`, true);
  }
});

uploadResetBtn.addEventListener('click', () => {
  const selected = findSelectedSeries();
  uploadForm.reset();
  if (selected) {
    uploadSeriesSelect.value = selected.seriesName;
    episodeNumberInput.value = String(selected.nextEpisode);
  } else {
    episodeNumberInput.value = '1';
  }
  uploadFileInput.value = '';
  clearUploadQueue();
  setUploadProgress('已清空上传表单。');
  renderQueuePreview();
});

const bootstrap = () => {
  const cachedKey = localStorage.getItem(API_KEY_STORAGE) || '';
  apiKeyInput.value = cachedKey;
  seriesPricePerEpisodeInput.value = '0.5';
  seriesFreeEpisodesInput.value = '0';

  seriesDrafts = readSeriesDrafts();
  updateSeriesSelect();
  renderQueuePreview();

  if (!cachedKey) {
    setApiStatus('尚未连接。');
    return;
  }

  setApiStatus('已读取本地 API Key，可直接上传。');
};

window.addEventListener('beforeunload', () => {
  clearUploadQueue();
});

bootstrap();
