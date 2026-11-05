import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';

// An incoming id from a gateway is reused only when it cannot carry an injection or a huge value.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
}

// BE-7: one JSON line per request, in English, with the correlation id. Only method, path and status are kept:
// no headers (tokens, cookies), no body (passwords), no query string (searches can hold names or emails).
export function loggerParams(config: ConfigService): Params {
  return {
    pinoHttp: [
      {
        level: config.getOrThrow<string>('LOG_LEVEL'),
        genReqId: requestId,
        customProps: (req: IncomingMessage & { id?: unknown }) => ({ reqId: req.id }),
        formatters: { level: (label: string) => ({ level: label }) },
        serializers: {
          req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url.split('?')[0] }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
        redact: { paths: ['req.headers', 'res.headers', '*.password', '*.token', '*.access_token'], remove: true },
        customLogLevel: (_req: IncomingMessage, res: ServerResponse, error?: Error) =>
          error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      },
      process.stdout,
    ],
  };
}
