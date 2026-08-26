import { EventEmitter } from 'events';
import { db } from './db.js';
import logger from './logger.js';

const emitter = new EventEmitter();

// Log any unhandled error events emitted
emitter.on('error', (err) => {
  logger.error('Unhandled EventEmitter error', { error: err.message, stack: err.stack });
});

async function createNotification({ recipient_id, type, actor_id, payload }) {
  try {
    await db('notifications').insert({
      recipient_id,
      type,
      actor_id,
      payload: JSON.stringify(payload)
    });
  } catch (err) {
    logger.error('Failed to create notification record in database', {
      error: err.message,
      stack: err.stack,
      recipient_id,
      type,
      actor_id,
    });
  }
}

emitter.on('ProjectCreated', async ({ projectId, projectTitle, creatorId }) => {
  try {
    await createNotification({
      recipient_id: creatorId,
      type: 'project_created',
      actor_id: creatorId,
      payload: { projectId, projectTitle },
    });
  } catch (err) {
    logger.error('Error handling ProjectCreated event', { error: err.message, projectId });
  }
});

emitter.on('ProjectLiked', async ({ projectId, projectTitle, likerId, likerName, ownerId }) => {
  try {
    if (likerId === ownerId) return;

    await createNotification({
      recipient_id: ownerId,
      type: 'project_liked',
      actor_id: likerId,
      payload: { projectId, projectTitle, likerName },
    });
  } catch (err) {
    logger.error('Error handling ProjectLiked event', { error: err.message, projectId });
  }
});

emitter.on('StudentFollowed', async ({ followerId, followerName, studentId }) => {
  try {
    await createNotification({
      recipient_id: studentId,
      type: 'student_followed',
      actor_id: followerId,
      payload: { followerName },
    });
  } catch (err) {
    logger.error('Error handling StudentFollowed event', { error: err.message, studentId });
  }
});

emitter.on('ProjectApproved', async ({ projectId, projectTitle, studentId }) => {
  try {
    await createNotification({
      recipient_id: studentId,
      type: 'project_approved',
      actor_id: 1,
      payload: { projectId, projectTitle },
    });
  } catch (err) {
    logger.error('Error handling ProjectApproved event', { error: err.message, projectId });
  }
});

export default emitter;
