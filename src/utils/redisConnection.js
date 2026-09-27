import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || (
  process.env.NODE_ENV === 'production'
    ? 'redis://redis:6379'
    : 'redis://localhost:6379'
);

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});
