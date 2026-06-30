import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { db } from '../src/db.js';
import path from 'path';
import fs from 'fs';

let studentToken;
let testProjectId;

describe('US-PROJ: Project Management', () => {
  beforeAll(async () => {
    // Login as student to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@school.com', password: 'password123' });
    studentToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    // Teardown project
    if (testProjectId) {
      await db('projects').where({ id: testProjectId }).del();
    }
  });

  it('US-PROJ-01: Student can create a new project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Vitest Test Project',
        description: 'Testing project creation'
      });
    
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Vitest Test Project');
    testProjectId = res.body.id;
  });

  it('US-PROJ-03: Student can edit their project details', async () => {
    const res = await request(app)
      .put(`/api/projects/${testProjectId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Updated Test Project',
        description: 'New description'
      });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Updated Test Project');
    expect(res.body.description).toBe('New description');
  });

  it('US-PROJ-05: Student can see a list of their own projects on their profile', async () => {
    // First, get student ID from /me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`);
    const studentId = meRes.body.id;

    // Fetch profile
    const profileRes = await request(app)
      .get(`/api/users/${studentId}/profile`)
      .set('Authorization', `Bearer ${studentToken}`);
    
    expect(profileRes.statusCode).toBe(200);
    expect(Array.isArray(profileRes.body.projects)).toBe(true);
    // Ensure our created project is in the list
    const found = profileRes.body.projects.find(p => p.id === testProjectId);
    expect(found).toBeDefined();
  });

  it('US-PROJ-02: Student can upload a thumbnail image', async () => {
    // Create a dummy file for testing
    const dummyPath = path.join(process.cwd(), 'dummy.png');
    fs.writeFileSync(dummyPath, 'fake-image-data');

    const res = await request(app)
      .post(`/api/projects/${testProjectId}/thumbnail`)
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('thumbnail', dummyPath);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.project.thumbnail_url).toMatch(/^\/uploads\//);

    fs.unlinkSync(dummyPath);
  });

  it('US-PROJ-04: Student can delete a project', async () => {
    // Create a temporary project just for deletion
    const tempRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'To Be Deleted', description: 'x' });
    
    const tempId = tempRes.body.id;

    const delRes = await request(app)
      .delete(`/api/projects/${tempId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.message).toMatch(/deleted successfully/i);

    // Verify it's gone
    const checkRes = await db('projects').where({ id: tempId });
    expect(checkRes.length).toBe(0);
  });
});
