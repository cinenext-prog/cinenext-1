#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import requestUploadHandler from '../api/request-upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const app = express();
const port = Number(process.env.LOCAL_PROXY_PORT || 4173);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'local-proxy', ts: Date.now() });
});

app.all('/api/request-upload', async (req, res) => {
  await requestUploadHandler(req, res);
});

app.use(express.static(distDir, { extensions: ['html'] }));

app.get(/.*/, (req, res) => {
  if (req.path.endsWith('.html')) {
    return res.sendFile(path.join(distDir, req.path));
  }

  return res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`\nLocal proxy server started at http://localhost:${port}`);
  console.log(`- 管理页: http://localhost:${port}/admin.html`);
  console.log(`- 上传页: http://localhost:${port}/upload.html`);
  console.log(`- 健康检查: http://localhost:${port}/api/health\n`);
  console.log('如需服务端保存 API Key，可设置环境变量 LIVEPEER_API_KEY 后重启。');
});
