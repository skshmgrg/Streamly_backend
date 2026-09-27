import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redisConnection.js';

export const videoQueue = new Queue('video-processing', {
  connection: redisConnection,
});
