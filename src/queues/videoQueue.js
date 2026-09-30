import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redisConnection.js';

export const videoQueue = process.env.NODE_ENV === 'test'
  ? {
      add: async () => ({}),
      close: async () => {},
    }
  : new Queue('video-processing', {
      connection: redisConnection,
    });
