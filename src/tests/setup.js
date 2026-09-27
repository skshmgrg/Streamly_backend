import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { videoQueue } from '../queues/videoQueue.js';
import { redisConnection } from '../utils/redisConnection.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URL = mongoUri;
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
  process.env.ACCESS_TOKEN_EXPIRY = '1d';
  process.env.REFRESH_TOKEN_EXPIRY = '7d';
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';

  await mongoose.connect(mongoUri);
}, 60000);

afterAll(async () => {
  await videoQueue.close();
  await redisConnection.quit();
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 60000);
