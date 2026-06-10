import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';

// Logger setup
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
});

// Redis connection
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue definitions
const queues = {
  intake: new Queue('intake', { connection }),
  underwrite: new Queue('underwrite', { connection }),
  bidding: new Queue('bidding', { connection }),
  budget: new Queue('budget', { connection }),
  changeOrders: new Queue('change_orders', { connection }),
  health: new Queue('health', { connection }),
};

// Health check worker
const healthWorker = new Worker(
  'health',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing health check');
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      data: job.data,
    };
  },
  {
    connection,
    concurrency: 1,
  }
);

// Intake worker
const intakeWorker = new Worker(
  'intake',
  async (job) => {
    logger.info({ jobId: job.id, type: job.name }, 'Processing intake job');
    // TODO: Implement intake logic
    return { processed: true };
  },
  {
    connection,
    concurrency: 5,
  }
);

// Underwrite worker
const underwriteWorker = new Worker(
  'underwrite',
  async (job) => {
    logger.info({ jobId: job.id, type: job.name }, 'Processing underwrite job');
    // TODO: Implement underwriting logic
    return { processed: true };
  },
  {
    connection,
    concurrency: 3,
  }
);

// Bidding worker
const biddingWorker = new Worker(
  'bidding',
  async (job) => {
    logger.info({ jobId: job.id, type: job.name }, 'Processing bidding job');
    // TODO: Implement bidding logic
    return { processed: true };
  },
  {
    connection,
    concurrency: 3,
  }
);

// Budget worker
const budgetWorker = new Worker(
  'budget',
  async (job) => {
    logger.info({ jobId: job.id, type: job.name }, 'Processing budget job');
    // TODO: Implement budget tracking logic
    return { processed: true };
  },
  {
    connection,
    concurrency: 3,
  }
);

// Change orders worker
const changeOrdersWorker = new Worker(
  'change_orders',
  async (job) => {
    logger.info({ jobId: job.id, type: job.name }, 'Processing change order job');
    // TODO: Implement change order logic
    return { processed: true };
  },
  {
    connection,
    concurrency: 2,
  }
);

// Worker error handlers
const workers = [
  healthWorker,
  intakeWorker,
  underwriteWorker,
  biddingWorker,
  budgetWorker,
  changeOrdersWorker,
];

workers.forEach((worker) => {
  worker.on('completed', (job) => {
    logger.info(
      { jobId: job.id, queue: job.queueName },
      'Job completed successfully'
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, queue: job?.queueName, error: err.message },
      'Job failed'
    );
  });
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start message
logger.info('Workers ready');

// Health check endpoint (simple HTTP server)
import { createServer } from 'http';

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', workers: workers.length }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.WORKERS_PORT || 4000;
server.listen(PORT, () => {
  logger.info(`Health check server listening on port ${PORT}`);
});

// Test health queue on startup
(async () => {
  try {
    await queues.health.add('startup-check', {
      message: 'Workers initialized',
      timestamp: new Date().toISOString(),
    });
    logger.info('Startup health check job queued');
  } catch (error) {
    logger.error({ error }, 'Failed to queue startup health check');
  }
})();

export { queues, logger };