import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { logger } from './logger';

// Redis connection
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue instances cache
const queues: Map<string, Queue> = new Map();

/**
 * Gets or creates a queue instance
 */
export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, { connection });
    queues.set(name, queue);

    logger.info({ queue: name }, 'Queue initialized');
  }
  return queues.get(name)!;
}

/**
 * Enqueues a job to the specified queue
 */
export async function enqueue(
  queueName: string,
  payload: any,
  options: {
    delay?: number;
    priority?: number;
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
  } = {}
): Promise<string> {
  try {
    const queue = getQueue(queueName);

    const job = await queue.add(
      `${queueName}-job`,
      payload,
      {
        delay: options.delay,
        priority: options.priority || 0,
        attempts: options.attempts || 3,
        backoff: options.backoff || {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep max 100 completed jobs
        },
        removeOnFail: {
          age: 24 * 3600, // Keep failed jobs for 24 hours
        },
      }
    );

    logger.info({
      queue: queueName,
      jobId: job.id,
      payload,
    }, 'Job enqueued successfully');

    return job.id!;
  } catch (error) {
    logger.error({
      error,
      queue: queueName,
      payload,
    }, 'Failed to enqueue job');
    throw error;
  }
}

/**
 * Bulk enqueue jobs to a queue
 */
export async function bulkEnqueue(
  queueName: string,
  jobs: Array<{ name?: string; data: any; opts?: any }>
): Promise<string[]> {
  try {
    const queue = getQueue(queueName);

    const bulkJobs = jobs.map((job) => ({
      name: job.name || `${queueName}-job`,
      data: job.data,
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        ...job.opts,
      },
    }));

    const results = await queue.addBulk(bulkJobs);
    const jobIds = results.map((job) => job.id!);

    logger.info({
      queue: queueName,
      jobCount: jobs.length,
      jobIds,
    }, 'Bulk jobs enqueued successfully');

    return jobIds;
  } catch (error) {
    logger.error({
      error,
      queue: queueName,
      jobCount: jobs.length,
    }, 'Failed to bulk enqueue jobs');
    throw error;
  }
}

/**
 * Gets queue events for monitoring
 */
export function getQueueEvents(queueName: string): QueueEvents {
  const queueEvents = new QueueEvents(queueName, { connection });

  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    logger.debug({
      queue: queueName,
      jobId,
      returnvalue,
    }, 'Job completed');
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error({
      queue: queueName,
      jobId,
      failedReason,
    }, 'Job failed');
  });

  return queueEvents;
}

/**
 * Gets queue metrics
 */
export async function getQueueMetrics(queueName: string) {
  try {
    const queue = getQueue(queueName);

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getJobCountByTypes('paused'),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + completed + failed + delayed + paused,
    };
  } catch (error) {
    logger.error({
      error,
      queue: queueName,
    }, 'Failed to get queue metrics');
    throw error;
  }
}

/**
 * Cleans up queue connections
 */
export async function closeQueues(): Promise<void> {
  for (const [name, queue] of queues) {
    await queue.close();
    logger.info({ queue: name }, 'Queue closed');
  }
  await connection.quit();
  logger.info('Redis connection closed');
}

export default {
  getQueue,
  enqueue,
  bulkEnqueue,
  getQueueEvents,
  getQueueMetrics,
  closeQueues,
};