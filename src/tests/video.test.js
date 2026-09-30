import { jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
process.env.ACCESS_TOKEN_EXPIRY = '1d';
process.env.REFRESH_TOKEN_EXPIRY = '7d';

const uploadOnCloudinaryMock = jest.fn(async (filePath) => {
  if (String(filePath).endsWith('.mp4')) {
    return { url: 'https://example.com/video.mp4', public_id: 'video-public-id', duration: 120 };
  }

  return { url: 'https://example.com/thumbnail.png', public_id: 'thumbnail-public-id' };
});

const deleteFromCloudinaryMock = jest.fn(async () => ({ result: 'ok' }));

jest.unstable_mockModule('../utils/cloudinary.js', () => ({
  uploadOnCloudinary: uploadOnCloudinaryMock,
  deleteFromCloudinary: deleteFromCloudinaryMock,
}));

const { default: app } = await import('../app.js');
const { User } = await import('../models/user.models.js');
const { Video } = await import('../models/video.models.js');
const request = (await import('supertest')).default;

describe('Video API', () => {
  let authCookie;
  let user;

  beforeEach(async () => {
    uploadOnCloudinaryMock.mockClear();
    deleteFromCloudinaryMock.mockClear();
    await User.deleteMany({});
    await Video.deleteMany({});

    user = await User.create({
      fullName: 'Video Owner',
      email: 'video-owner@example.com',
      username: 'videoowner',
      password: 'Password123',
      avatar: 'https://example.com/avatar.png',
      avatarPublicId: 'avatar-public-id',
    });

    const loginResponse = await request(app)
      .post('/api/v1/users/login')
      .send({
        username: 'videoowner',
        password: 'Password123',
      });

    authCookie = loginResponse.headers['set-cookie'];
  });

  it('creates a video successfully', async () => {
    const response = await request(app)
      .post('/api/v1/videos')
      .set('Cookie', authCookie)
      .field('title', 'Test Video')
      .field('description', 'A test video')
      .attach('videoFile', Buffer.from('fake-video'), {
        filename: 'test.mp4',
        contentType: 'video/mp4',
      })
      .attach('thumbnail', Buffer.from('fake-thumb'), {
        filename: 'thumb.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(202);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('processing');
    expect(response.body.data.videoId).toBeTruthy();
  });

  it('gets all videos', async () => {
    await Video.create({
      title: 'Video One',
      description: 'desc one',
      videoFile: 'https://example.com/video-1.mp4',
      videoPublicId: 'video-1',
      thumbnail: 'https://example.com/thumb-1.png',
      thumbnailPublicId: 'thumb-1',
      duration: 60,
      status: 'ready',
      owner: user._id,
    });

    const response = await request(app)
      .get('/api/v1/videos')
      .set('Cookie', authCookie)
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.videos.length).toBeGreaterThan(0);
  });

  it('gets a video by id', async () => {
    const createdVideo = await Video.create({
      title: 'Video One',
      description: 'desc one',
      videoFile: 'https://example.com/video-1.mp4',
      videoPublicId: 'video-1',
      thumbnail: 'https://example.com/thumb-1.png',
      thumbnailPublicId: 'thumb-1',
      duration: 60,
      owner: user._id,
    });

    const response = await request(app)
      .get(`/api/v1/videos/${createdVideo._id}`)
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data._id).toBe(String(createdVideo._id));
  });

  it('deletes a video owned by the current user', async () => {
    const createdVideo = await Video.create({
      title: 'Video to delete',
      description: 'desc',
      videoFile: 'https://example.com/video-delete.mp4',
      videoPublicId: 'video-delete',
      thumbnail: 'https://example.com/thumb-delete.png',
      thumbnailPublicId: 'thumb-delete',
      duration: 30,
      owner: user._id,
    });

    const response = await request(app)
      .delete(`/api/v1/videos/${createdVideo._id}`)
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(await Video.findById(createdVideo._id)).toBeNull();
  });

});
