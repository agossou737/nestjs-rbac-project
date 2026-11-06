import type { ConnectionOptions } from 'bullmq';

// redis://[:password@]host:port/db into the options BullMQ passes to ioredis.
export function redisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number(url.pathname.slice(1) || 0),
    // Required by BullMQ workers: a blocked command must wait for Redis instead of failing after a few retries.
    maxRetriesPerRequest: null,
    connectTimeout: 10_000,
  };
}
