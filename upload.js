const API_KEY_STORAGE = 'cinenext_livepeer_api_key';
const LIVEPEER_API_BASE = 'https://livepeer.studio/api';

const apiKeyInput = document.querySelector('#api-key');
const saveKeyBtn = document.querySelector('#save-key');
const clearKeyBtn = document.querySelector('#clear-key');
const apiStatus = document.querySelector('#api-status');

const uploadForm = document.querySelector('#upload-form');
const seriesNameInput = document.querySelector('#series-name');
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

const buildMetadata = () => {
	const seriesName = seriesNameInput.value.trim();
	if (!seriesName) {
		throw new Error('请填写剧名');
	}

	const episodeNumber = Math.max(1, Number(episodeNumberInput.value || 1));
	const unlockType = uploadUnlockTypeInput.value === 'nft' ? 'nft' : 'free';

	const metadata = {
		seriesName,
		episodeNumber,
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

uploadForm.addEventListener('submit', async (event) => {
	event.preventDefault();

	const file = uploadFileInput.files?.[0];
	if (!file) {
		showToast('请选择视频文件', true);
		return;
	}

	const seriesName = seriesNameInput.value.trim();
	const episodeNumber = Math.max(1, Number(episodeNumberInput.value || 1));
	const uploadName = uploadNameInput.value.trim() || `${seriesName} 第${episodeNumber}集`;

	try {
		const metadata = buildMetadata();
		setUploadProgress('初始化上传...');
		await uploadByTus({ file, name: uploadName, metadata });
		setUploadProgress('上传完成，等待 Livepeer 处理...');
		showToast('上传成功，可返回列表页刷新查看');

		uploadFileInput.value = '';
		uploadNameInput.value = '';
	} catch (error) {
		setUploadProgress('上传失败。', true);
		showToast(error instanceof Error ? error.message : '上传失败', true);
	}
});

uploadResetBtn.addEventListener('click', () => {
	uploadForm.reset();
	episodeNumberInput.value = '1';
	uploadPriceInput.value = '0.5';
	setUploadProgress('已清空上传表单。');
});

const bootstrap = () => {
	const cachedKey = localStorage.getItem(API_KEY_STORAGE) || '';
	apiKeyInput.value = cachedKey;
	episodeNumberInput.value = '1';
	uploadPriceInput.value = '0.5';

	if (!cachedKey) {
		setApiStatus('尚未连接。');
		return;
	}

	setApiStatus('已读取本地 API Key，可直接上传。');
};

bootstrap();
