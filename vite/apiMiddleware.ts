// Serves the stand-in API from the Vite dev and preview servers, using the same handler
// the Vercel functions call. Local runs and the deployed site answer identically.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { handleApi } from '../api/_lib/router.js';

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  return Buffer.concat(chunks);
}

const middleware: Connect.NextHandleFunction = (request: IncomingMessage, response: ServerResponse, next) => {
  if (!request.url?.startsWith('/api/')) {
    next();
    return;
  }
  void (async () => {
    try {
      const method = request.method ?? 'GET';
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') headers.set(name, value);
      }
      const body = method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(await readBody(request));
      const answer = await handleApi(new Request(`http://localhost${request.url}`, { method, headers, body }));
      response.statusCode = answer.status;
      answer.headers.forEach((value, name) => response.setHeader(name, value));
      response.end(Buffer.from(await answer.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  })();
};

export function standInApi(): Plugin {
  return {
    name: 'stand-in-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
