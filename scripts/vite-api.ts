import { pathToFileURL } from 'node:url';
import path from 'node:path';
import type { Plugin } from 'vite';
const endpoints = new Set(['session', 'users', 'leave', 'swaps', 'attendance', 'attendance-cron', 'change-pin', 'send-push']);
/** Local equivalent of Vercel's Node handlers. Credentials stay in the Node process. */
export function localApi(): Plugin {
  return {
    name: 'local-server-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        const endpoint = req.url?.split('?')[0].replace(/^\//, '') || '';
        if (!endpoints.has(endpoint)) return next();
        try {
          let raw = '';
          for await (const chunk of req) {
            raw += String(chunk);
            if (raw.length > 100_000) { res.statusCode = 413; res.end('Request too large'); return; }
          }
          const body: unknown = raw ? JSON.parse(raw) : {};
          const response = {
            setHeader: (key: string, value: string) => res.setHeader(key, value),
            status(code: number) { res.statusCode = code; return this; },
            json(value: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return this; },
            end() { res.end(); },
          };
          const { default: handler } = await import(pathToFileURL(path.resolve(process.cwd(), 'api', endpoint + '.js')).href);
          await handler(Object.assign(req, { body }), response);
        } catch {
          res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'API request failed' }));
        }
      });
    },
  };
}
