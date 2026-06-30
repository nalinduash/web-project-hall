import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { db } from '../src/db.js';

let adminToken, studentToken, tempUserId, testProjectId, dynamicEmail;

describe('US-ADM: Administration & Moderation', () => {
  beforeAll(async () => {
    // 1. Log in admin
    const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@school.com', password: 'password123' });
    adminToken = adminRes.body.access_token;

    // 2. Log in student
    const studentRes = await request(app).post('/api/auth/login').send({ email: 'student@school.com', password: 'password123' });
    studentToken = studentRes.body.access_token;

    // 3. Create a temp user to modify
    dynamicEmail = `temp_mod_${Date.now()}@school.com`;
    const tempUserRes = await request(app).post('/api/auth/signup').send({ email: dynamicEmail, password: 'password123', role_id: 3 });
    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tempUserRes.body.access_token}`);
    tempUserId = meRes.body.id;

    // 4. Create a test project to moderate
    const pRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Inappropriate Content', description: 'Rule breaking project' });
    testProjectId = pRes.body.id;
  });

  afterAll(async () => {
    // Teardown
    if (tempUserId) {
      await db('users').where({ id: tempUserId }).del();
    }
    if (testProjectId) {
      await db('projects').where({ id: testProjectId }).del();
    }
  });

  it('US-ADM-01: Admin can view a list of all registered users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Ensure our temp user is in the list
    const found = res.body.find(u => u.email === dynamicEmail);
    expect(found).toBeDefined();
    expect(found.role_id).toBe(3); // created as student
  });

  it('US-ADM-02: Admin can change a user role (promote to recruiter)', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${tempUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: 2 }); // Promote to recruiter
    
    expect(res.statusCode).toBe(200);
    expect(res.body.user.role_id).toBe(2);

    // Verify DB update
    const dbCheck = await db('users').where({ id: tempUserId }).first('role_id');
    expect(dbCheck.role_id).toBe(2);
  });

  it('US-ADM-03: Admin can view all projects, including hidden ones', async () => {
    // First, approve the project to make it public
    await request(app)
      .patch(`/api/admin/projects/${testProjectId}/visibility`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ visibility: 'public' });

    const preCheck = await request(app).get('/api/projects').set('Authorization', `Bearer ${studentToken}`);
    expect(preCheck.body.find(p => p.id === testProjectId)).toBeDefined();

    // Admin view
    const res = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.find(p => p.id === testProjectId)).toBeDefined();
  });

  it('US-ADM-04: Admin can hide inappropriate projects from the public feed (Soft-remove)', async () => {
    const patchRes = await request(app)
      .patch(`/api/admin/projects/${testProjectId}/visibility`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ visibility: 'removed' });
    
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body.project.visibility).toBe('removed');

    // Verify it is NO LONGER in the public feed
    const publicRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${studentToken}`);
    
    const hiddenProj = publicRes.body.find(p => p.id === testProjectId);
    expect(hiddenProj).toBeUndefined(); // Should not exist

    // Verify it IS STILL in the admin feed
    const adminRes = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.body.find(p => p.id === testProjectId)).toBeDefined();
  });
});
