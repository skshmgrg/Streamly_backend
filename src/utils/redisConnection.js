import IORedis from 'ioredis';

const isTest = process.env.NODE_ENV === 'test';
const redisUrl = process.env.REDIS_URL || (
  process.env.NODE_ENV === 'production'
    ? 'redis://redis:6379'
    : 'redis://localhost:6379'
);

export const redisConnection = isTest
  ? { quit: async () => {} }
  : new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
