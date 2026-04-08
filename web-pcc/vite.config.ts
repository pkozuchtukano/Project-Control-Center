import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import type { IncomingMessage } from 'http';
import { handleYouTrackRequest } from './server/youtrackProxy';

const readRequestBody = async (request: IncomingMessage) => new Promise<string>((resolve, reject) => {
  const chunks: Buffer[] = [];

  request.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  request.on('end', () => {
    resolve(Buffer.concat(chunks).toString('utf8'));
  });
  request.on('error', reject);
});

export default defineConfig(({ mode }) => {
  const localEnv = loadEnv(mode, __dirname, '');
  const baseUrl = localEnv.YOUTRACK_BASE_URL?.trim() || localEnv.VITE_YOUTRACK_BASE_URL?.trim() || '';
  const token = localEnv.YOUTRACK_TOKEN?.trim() || localEnv.VITE_YOUTRACK_TOKEN?.trim() || '';

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'youtrack-dev-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.method !== 'POST' || req.url?.split('?')[0] !== '/api/youtrack') {
              return next();
            }

            const response = await handleYouTrackRequest(await readRequestBody(req), { baseUrl, token });
            res.statusCode = response.statusCode;
            res.setHeader('Content-Type', 'application/json');
            res.end(response.body);
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 4174,
    },
  };
});
