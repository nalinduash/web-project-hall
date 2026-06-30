import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { db } from '../src/db.js';

let studentToken, recruiterToken, studentId;
let testProjectId;

describe('US-ENG & US-NOT: Browsing, Engagement & Notifications', () => {
  beforeAll(async () => {
    // 1. Get tokens
    const sLogin = await request(app).post('/api/auth/login').send({ email: 'student@school.com', password: 'password123' });
    studentToken = sLogin.body.access_token;

    const rLogin = await request(app).post('/api/auth/login').send({ email: 'recruiter@school.com', password: 'password123' });
    recruiterToken = rLogin.body.access_token;

    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${studentToken}`);
    studentId = meRes.body.id;

    // 2. Create a project to engage with
    const pRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Engagement Test', description: 'Testing likes and follows' });
    testProjectId = pRes.body.id;

    // 3. Approve the project so recruiters can see it (Private by Default)
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@school.com', password: 'password123' });
    await request(app)
      .patch(`/api/admin/projects/${testProjectId}/visibility`)
      .set('Authorization', `Bearer ${adminLogin.body.access_token}`)
      .send({ visibility: 'public' });
  });

  afterAll(async () => {
    // Teardown
    if (testProjectId) {
      await db('projects').where({ id: testProjectId }).del();
    }
    // Cleanup any follows/notifications created during tests
    await db('student_follows').where({ student_id: studentId }).del();
    await db('notifications').where({ recipient_id: studentId }).del();
  });

  it('US-BWS-01: Recruiter can scroll through a feed of all public projects', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${recruiterToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Ensure our test project is visible
    const found = res.body.find(p => p.id === testProjectId);
    expect(found).toBeDefined();
    expect(found).toHaveProperty('author_name');
  });

  it('US-BWS-02: Recruiter can view a project detailed page', async () => {
    const res = await request(app)
      .get(`/api/projects/${testProjectId}`)
      .set('Authorization', `Bearer ${recruiterToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(testProjectId);
  });

  it('US-ENG-01 & US-NOT-01: Recruiter can "like" a project & student gets notified', async () => {
    const likeRes = await request(app)
      .post(`/api/projects/${testProjectId}/like`)
      .set('Authorization', `Bearer ${recruiterToken}`);
    
    expect(likeRes.statusCode).toBe(200);
    expect(likeRes.body.liked).toBe(true);
    expect(likeRes.body.like_count).toBeGreaterThanOrEqual(1);

    // Wait slightly for async event emitter to write to DB
    await new Promise(r => setTimeout(r, 100));

    // Verify Notification (US-NOT-01)
    const notifRes = await request(app)
      .get('/api/users/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    
    expect(notifRes.statusCode).toBe(200);
    const likeNotif = notifRes.body.find(n => n.type === 'project_liked' && n.payload.projectId === testProjectId);
    expect(likeNotif).toBeDefined();
    expect(likeNotif.read).toBe(false);
  });

  it('US-ENG-02: Recruiter can "unlike" a project if accidentally clicked', async () => {
    const unlikeRes = await request(app)
      .post(`/api/projects/${testProjectId}/like`)
      .set('Authorization', `Bearer ${recruiterToken}`);
    
    expect(unlikeRes.statusCode).toBe(200);
    expect(unlikeRes.body.liked).toBe(false); // Toggle behavior
  });

  it('US-ENG-03 & US-NOT-02: Recruiter can "follow" a student & student gets notified', async () => {
    // 1. Unfollow first if already following (due to state bleed in dev DB)
    await db('student_follows').where({ student_id: studentId }).del();

    const followRes = await request(app)
      .post(`/api/users/${studentId}/follow`)
      .set('Authorization', `Bearer ${recruiterToken}`);
    
    expect(followRes.statusCode).toBe(200);
    expect(followRes.body.following).toBe(true);

    await new Promise(r => setTimeout(r, 100));

    // Verify Notification (US-NOT-02)
    const notifRes = await request(app)
      .get('/api/users/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    
    const followNotif = notifRes.body.find(n => n.type === 'student_followed');
    expect(followNotif).toBeDefined();
  });

  it('US-ENG-04 & US-ENG-05: Recruiter views student profile and sees follower count', async () => {
    const profileRes = await request(app)
      .get(`/api/users/${studentId}/profile`)
      .set('Authorization', `Bearer ${recruiterToken}`);
    
    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.body.user.id).toBe(studentId);
    expect(profileRes.body.follower_count).toBeGreaterThanOrEqual(1); // Since we just followed
  });

  it('US-NOT-03 & US-NOT-04: Student checks inbox and marks notification as read', async () => {
    // Fetch notifications
    const notifRes = await request(app)
      .get('/api/users/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    
    const targetNotif = notifRes.body[0]; // grab the most recent

    const markRes = await request(app)
      .patch(`/api/users/notifications/${targetNotif.id}/read`)
      .set('Authorization', `Bearer ${studentToken}`);
    
    expect(markRes.statusCode).toBe(200);
    expect(markRes.body.read).toBe(true);
  });

  it('US-NOT-05: User can mark all notifications as read', async () => {
    const markAllRes = await request(app)
      .patch('/api/users/notifications/read-all')
      .set('Authorization', `Bearer ${studentToken}`);
    
    expect(markAllRes.statusCode).toBe(200);

    // Verify all are read
    const notifRes = await request(app)
      .get('/api/users/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    
    const unread = notifRes.body.filter(n => n.read === false);
    expect(unread.length).toBe(0);
  });
});
