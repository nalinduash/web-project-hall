import { EventEmitter } from 'events';
import { db } from './db.js';

const emitter = new EventEmitter();

async function createNotification({ recipient_id, type, actor_id, payload }) {
  try {
    await db('notifications').insert({
      recipient_id,
      type,
      actor_id,
      payload: JSON.stringify(payload)
    });
  } catch (err) {
    // Silently fail or log to an error monitoring service in prod
  }
}

emitter.on('ProjectCreated', async ({ projectId, projectTitle, creatorId }) => {
  await createNotification({
    recipient_id: creatorId,
    type: 'project_created',
    actor_id: creatorId,
    payload: { projectId, projectTitle },
  });
});

emitter.on('ProjectLiked', async ({ projectId, projectTitle, likerId, likerName, ownerId }) => {
  if (likerId === ownerId) return;

  await createNotification({
    recipient_id: ownerId,
    type: 'project_liked',
    actor_id: likerId,
    payload: { projectId, projectTitle, likerName },
  });
});

emitter.on('StudentFollowed', async ({ followerId, followerName, studentId }) => {
  await createNotification({
    recipient_id: studentId,
    type: 'student_followed',
    actor_id: followerId,
    payload: { followerName },
  });
});
emitter.on('ProjectApproved', async ({ projectId, projectTitle, studentId }) => {
  await createNotification({
    recipient_id: studentId,
    type: 'project_approved',
    actor_id: 1, // Assuming admin is actor, or we could just use studentId if no admin id is provided
    payload: { projectId, projectTitle },
  });
});

export default emitter;
