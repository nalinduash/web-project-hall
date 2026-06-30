import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { db, initializeDatabase } from '../src/db.js';

let adminToken;
let studentToken;

describe('US-AUTH: Authentication & Identity', () => {
  beforeAll(async () => {
    // Ensure DB is initialized before tests
    await initializeDatabase();
  });

  afterAll(async () => {
    // Clean up test data inserted during this suite
    await db('users').where({ email: 'test.signup@example.com' }).del();
  });

  it('US-AUTH-02: Recruiter/Admin can sign up and log in via password', async () => {
    // 1. Sign up
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test.signup@example.com',
        password: 'securePassword123',
        role_id: 2 // recruiter
      });
    
    expect(signupRes.statusCode).toBe(201);
    expect(signupRes.body).toHaveProperty('access_token');
    expect(signupRes.body).toHaveProperty('refresh_token');

    // 2. Log in
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test.signup@example.com',
        password: 'securePassword123'
      });
    
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body).toHaveProperty('access_token');
  });

  it('US-AUTH-03: User can log in using OTP passwordless flow', async () => {
    // 1. Send OTP
    const sendRes = await request(app)
      .post('/api/auth/otp/send')
      .send({ email: 'admin@school.com' }); // Seeded user
    
    expect(sendRes.statusCode).toBe(200);
    
    // Grab the OTP directly from DB for testing (since it simulates email)
    const otpResult = await db('otps')
      .where({ email: 'admin@school.com' })
      .orderBy('created_at', 'desc')
      .first('code');
    const code = otpResult.code;

    // 2. Verify OTP
    const verifyRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: 'admin@school.com', code });
    
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body).toHaveProperty('access_token');
    adminToken = verifyRes.body.access_token;
  });

  it('US-AUTH-04: Session remains active (Refresh Token rotation)', async () => {
    // Login to get a fresh refresh token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@school.com', password: 'password123' });
    
    const initialRefreshToken = loginRes.body.refresh_token;

    // Refresh the token
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: initialRefreshToken });
    
    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.body).toHaveProperty('access_token');
    expect(refreshRes.body).toHaveProperty('refresh_token');
    
    const newRefreshToken = refreshRes.body.refresh_token;
    expect(newRefreshToken).not.toBe(initialRefreshToken); // Rotation proven

    // Reusing the old revoked token should fail (replay protection)
    const replayRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: initialRefreshToken });
    
    expect(replayRes.statusCode).toBe(401);
  });

  it('US-AUTH-05: User can securely log out (Revoke token)', async () => {
    // Login first
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@school.com', password: 'password123' });
    
    const rt = loginRes.body.refresh_token;

    // Revoke
    const revokeRes = await request(app)
      .post('/api/auth/revoke')
      .send({ token: rt });
    
    expect(revokeRes.statusCode).toBe(200);

    // Attempting to refresh should now fail
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: rt });
    
    expect(refreshRes.statusCode).toBe(401);
  });
});
