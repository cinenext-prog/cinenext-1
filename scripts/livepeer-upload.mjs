#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://livepeer.studio/api';

const parseArgs = (argv) => {
  const options = {
    files: [],
    totalEpisodes: 1,
    startEpisode: 1,
    freeEpisodes: 0,
    pricePerEpisode: 0.5,
    staticMp4: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      options.files.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    const readValue = () => {
      if (!next || next.startsWith('--')) {
        throw new Error(`参数 --${key} 缺少值`);
      }
      index += 1;
      return next;
    };

    switch (key) {
      case 'api-key':
        options.apiKey = readValue();
        break;
      case 'series':
        options.seriesName = readValue();
        break;
      case 'total':
        options.totalEpisodes = Number(readValue());
        break;
      case 'start':
        options.startEpisode = Number(readValue());
        break;
      case 'free':
        options.freeEpisodes = Number(readValue());
        break;
      case 'price':
        options.pricePerEpisode = Number(readValue());
        break;
      case 'description':
        options.description = readValue();
        break;
      case 'actors':
        options.actors = readValue();
        break;
      case 'name-prefix':
        options.namePrefix = readValue();
        break;
      case 'static-mp4':
        options.staticMp4 = true;
        break;
      case 'dry-run':
        options.dryRun = true;
        break;
      case 'help':
        options.help = true;
        break;
      default:
        throw new Error(`未知参数: --${key}`);
    }
  }

  return options;
};

const printHelp = () => {
  console.log(`\nLivepeer 本地上传 CLI\n
用法:
  npm run upload -- --api-key <LIVEPEER_API_KEY> --series <剧名> --total <总集数> --start <起始集数> --free <前X集免费> --price <每集价格> <文件1> <文件2> ...

可选参数:
  --description <简介>
  --actors <演员A,演员B>
  --name-prefix <名称前缀>
  --static-mp4               让 Livepeer 生成静态 MP4
  --dry-run                  仅打印计划，不实际上传
  --help

示例:
  npm run upload -- --api-key lp_xxx --series "总裁的替身新娘" --total 20 --start 1 --free 3 --price 0.5 ./videos/*.mp4
`);
};

const ensureOptions = (options) => {
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (!options.apiKey) throw new Error('缺少 --api-key');
  if (!options.seriesName) throw new Error('缺少 --series');
  if (!Number.isFinite(options.totalEpisodes) || options.totalEpisodes < 1) throw new Error('--total 必须 >= 1');
  if (!Number.isFinite(options.startEpisode) || options.startEpisode < 1) throw new Error('--start 必须 >= 1');
  if (!Number.isFinite(options.freeEpisodes) || options.freeEpisodes < 0) throw new Error('--free 必须 >= 0');
  if (!Number.isFinite(options.pricePerEpisode) || options.pricePerEpisode < 0) throw new Error('--price 必须 >= 0');
  if (!options.files.length) throw new Error('请至少提供 1 个视频文件路径');
};

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

const resolveFileList = (rawFiles) => {
  const files = rawFiles
    .map((filePath) => path.resolve(filePath))
    .filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile())
    .sort((left, right) => collator.compare(path.basename(left), path.basename(right)));

  if (!files.length) {
    throw new Error('没有找到可上传的本地文件，请检查路径是否正确');
  }

  return files;
};

const requestUploadTicket = async ({ apiKey, name, metadata, staticMp4 }) => {
  const response = await fetch(`${API_BASE}/asset/request-upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      metadata,
      staticMp4,
    }),
  });

  const text = await response.text();
  let parsed;
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
      `HTTP ${response.status}`;
    throw new Error(`申请上传地址失败: ${reason}`);
  }

  if (!parsed?.url) {
    throw new Error('上传票据缺少 url，无法进行直传');
  }

  return parsed;
};

const directUploadFile = async ({ uploadUrl, filePath }) => {
  const body = fs.createReadStream(filePath);
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    duplex: 'half',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`文件直传失败（HTTP ${response.status}）${text ? `: ${text.slice(0, 240)}` : ''}`);
  }
};

const toActorsArray = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const buildMetadata = ({ options, episodeNumber }) => {
  const isFreeEpisode = episodeNumber <= options.freeEpisodes;
  return {
    seriesName: options.seriesName,
    episodeNumber,
    totalEpisodes: options.totalEpisodes,
    freeEpisodes: options.freeEpisodes,
    isFreeEpisode,
    unlockType: isFreeEpisode ? 'free' : 'paid',
    price: isFreeEpisode ? '0' : String(options.pricePerEpisode),
    seriesDescription: options.description || '',
    actors: toActorsArray(options.actors),
  };
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));
  ensureOptions(options);

  const files = resolveFileList(options.files);
  const endEpisode = options.startEpisode + files.length - 1;

  if (endEpisode > options.totalEpisodes) {
    throw new Error(`本次上传会超出总集数：最后一集 ${endEpisode} > 总集数 ${options.totalEpisodes}`);
  }

  console.log(`\n准备上传 ${files.length} 个文件`);
  console.log(`剧名: ${options.seriesName}`);
  console.log(`集数: 第 ${options.startEpisode} 集 ~ 第 ${endEpisode} 集`);
  console.log(`免费策略: 前 ${options.freeEpisodes} 集免费；付费集单价 ${options.pricePerEpisode}`);

  files.forEach((filePath, index) => {
    const episodeNumber = options.startEpisode + index;
    console.log(`  [${episodeNumber}] ${path.basename(filePath)}`);
  });

  if (options.dryRun) {
    console.log('\n--dry-run 已启用，仅预览，不执行上传。');
    return;
  }

  for (let index = 0; index < files.length; index += 1) {
    const filePath = files[index];
    const episodeNumber = options.startEpisode + index;
    const uploadName = options.namePrefix
      ? `${options.namePrefix} 第${episodeNumber}集`
      : `${options.seriesName} 第${episodeNumber}集`;

    const metadata = buildMetadata({ options, episodeNumber });

    console.log(`\n[${index + 1}/${files.length}] 申请上传地址: 第 ${episodeNumber} 集`);
    const ticket = await requestUploadTicket({
      apiKey: options.apiKey,
      name: uploadName,
      metadata,
      staticMp4: options.staticMp4,
    });

    console.log(`[${index + 1}/${files.length}] 开始直传文件: ${path.basename(filePath)}`);
    await directUploadFile({ uploadUrl: ticket.url, filePath });

    const playbackId = ticket?.asset?.playbackId || ticket?.asset?.playbackID || '-';
    const assetId = ticket?.asset?.id || '-';
    console.log(`[${index + 1}/${files.length}] 上传完成: asset=${assetId}, playbackId=${playbackId}`);
  }

  console.log('\n全部上传完成。');
};

run().catch((error) => {
  console.error('\n上传失败:', error instanceof Error ? error.message : error);
  process.exit(1);
});
