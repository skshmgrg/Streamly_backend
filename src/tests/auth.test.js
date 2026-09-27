import { jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
process.env.ACCESS_TOKEN_EXPIRY = '1d';
process.env.REFRESH_TOKEN_EXPIRY = '7d';

const uploadOnCloudinaryMock = jest.fn(async (filePath) => {
  if (!filePath) {
    return { url: 'https://example.com/avatar.png', public_id: 'avatar-public-id' };
  }

  return { url: 'https://example.com/avatar.png', public_id: 'avatar-public-id' };
});

const deleteFromCloudinaryMock = jest.fn(async () => ({ result: 'ok' }));

jest.unstable_mockModule('../utils/cloudinary.js', () => ({
  uploadOnCloudinary: uploadOnCloudinaryMock,
  deleteFromCloudinary: deleteFromCloudinaryMock,
}));

const { default: app } = await import('../app.js');
const { User } = await import('../models/user.models.js');
const request = (await import('supertest')).default;

const createUserPayload = ({
  fullName = 'Test User',
  email = 'test@example.com',
  username = 'testuser',
  password = 'Password123',
} = {}) => ({
  fullName,
  email,
  username,
  password,
});

describe('Auth flow', () => {
  beforeEach(async () => {
    uploadOnCloudinaryMock.mockClear();
    deleteFromCloudinaryMock.mockClear();
    await User.deleteMany({});
  });

  it('registers a user successfully', async () => {
    const payload = createUserPayload();

    const response = await request(app)
      .post('/api/v1/users/register')
      .field('fullName', payload.fullName)
      .field('email', payload.email)
      .field('username', payload.username)
      .field('password', payload.password)
      .attach('avatar', Buffer.from('fake-avatar'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeTruthy();
    expect(response.body.data.username).toBe(payload.username.toLowerCase());
  });

  it('fails registration when the username/email already exists', async () => {
    const payload = createUserPayload();
    await User.create({
      fullName: payload.fullName,
      email: payload.email,
      username: payload.username,
      password: payload.password,
      avatar: 'https://example.com/avatar.png',
      avatarPublicId: 'avatar-public-id',
    });

    const response = await request(app)
      .post('/api/v1/users/register')
      .field('fullName', payload.fullName)
      .field('email', payload.email)
      .field('username', payload.username)
      .field('password', payload.password)
      .attach('avatar', Buffer.from('fake-avatar'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it('logs in a user successfully', async () => {
    const payload = createUserPayload();
    await User.create({
      fullName: payload.fullName,
      email: payload.email,
      username: payload.username,
      password: payload.password,
      avatar: 'https://example.com/avatar.png',
      avatarPublicId: 'avatar-public-id',
    });

    const response = await request(app)
      .post('/api/v1/users/login')
      .send({
        username: payload.username,
        password: payload.password,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.username).toBe(payload.username.toLowerCase());
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('accessToken='),
        expect.stringContaining('refreshToken='),
      ])
    );
  });

  it('fails login with a wrong password', async () => {
    const payload = createUserPayload();
    await User.create({
      fullName: payload.fullName,
      email: payload.email,
      username: payload.username,
      password: payload.password,
      avatar: 'https://example.com/avatar.png',
      avatarPublicId: 'avatar-public-id',
    });

    const response = await request(app)
      .post('/api/v1/users/login')
      .send({
        username: payload.username,
        password: 'WrongPassword99',
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('gets the current user when authenticated', async () => {
    const payload = createUserPayload();
    const user = await User.create({
      fullName: payload.fullName,
      email: payload.email,
      username: payload.username,
      password: payload.password,
      avatar: 'https://example.com/avatar.png',
      avatarPublicId: 'avatar-public-id',
    });

    const loginResponse = await request(app)
      .post('/api/v1/users/login')
      .send({
        username: payload.username,
        password: payload.password,
      });

    const cookieHeader = loginResponse.headers['set-cookie'];

    const response = await request(app)
      .get('/api/v1/users/current-user')
      .set('Cookie', cookieHeader);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data._id).toBe(String(user._id));
  });

  it('fails current-user when unauthenticated', async () => {
    const response = await request(app).get('/api/v1/users/current-user');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
