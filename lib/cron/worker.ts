#!/usr/bin/env tsx
/**
 * FlipOps Legacy Cron Worker Service
 *
 * Long-running process that runs the 4 safety-critical guardrails (G1-G4)
 * via execSync subprocess isolation. Per Phase 6 of the freshness-layer
 * plan (Strategy C Hybrid, docs/development/FRESHNESS-LAYER-PLAN.md), the
 * 5 monitoring + discovery jobs migrated to worker-bullmq; only G1-G4
 * stay here because execSync's process isolation prevents a single bad
 * run from taking the entire worker down.
 *
 * Schedules (all UTC, every 15 minutes):
 *   - G1 Deal Approval
 *   - G2 Bid Spread
 *   - G3 Invoice and Budget
 *   - G4 Change Order
 *
 * Migrated to worker-bullmq (lib/cron/worker-bullmq-monitoring.ts):
 *   - data-refresh, pipeline-monitoring, contractor-performance,
 *     skip-tracing
 */

import cron from 'node-cron';
import { execSync } from 'child_process';
import path from 'path';

// Environment validation
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'BATCHDATA_API_KEY',
];

// Simple logging helpers
const log = (msg: string) => console.log(`[INFO] ${msg}`);
const error = (msg: string) => console.error(`[ERROR] ${msg}`);
const success = (msg: string) => console.log(`[SUCCESS] ✅ ${msg}`);
const warn = (msg: string) => console.warn(`[WARN] ⚠️  ${msg}`);

function validateEnvironment(): void {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);

  if (missing.length > 0) {
    error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  success('Environment validation passed');
}

// Workflow execution wrapper
interface WorkflowExecution {
  name: string;
  path: string;
  lastRun?: Date;
  lastStatus?: 'success' | 'error';
  lastError?: string;
  executionCount: number;
}

const workflows: Record<string, WorkflowExecution> = {
  // data-refresh / pipeline-monitoring / contractor-performance migrated to
  // worker-bullmq per Phase 6. See lib/cron/worker-bullmq-monitoring.ts.
  'g1-deal-approval': {
    name: 'G1: Deal Approval Alert',
    path: path.join(__dirname, 'guardrails', 'g1-deal-approval.ts'),
    executionCount: 0,
  },
  'g2-bid-spread': {
    name: 'G2: Bid Spread Alert',
    path: path.join(__dirname, 'guardrails', 'g2-bid-spread.ts'),
    executionCount: 0,
  },
  'g3-invoice-budget': {
    name: 'G3: Invoice & Budget Guardian',
    path: path.join(__dirname, 'guardrails', 'g3-invoice-budget.ts'),
    executionCount: 0,
  },
  'g4-change-order': {
    name: 'G4: Change Order Gatekeeper',
    path: path.join(__dirname, 'guardrails', 'g4-change-order.ts'),
    executionCount: 0,
  },
  // skip-tracing migrated to worker-bullmq per Phase 6.
};

/**
 * Execute a workflow and track its status
 */
async function executeWorkflow(workflowKey: string): Promise<void> {
  const workflow = workflows[workflowKey];
  const startTime = Date.now();

  log(`[${workflow.name}] Starting execution #${workflow.executionCount + 1}...`);

  try {
    // Execute the workflow using tsx
    execSync(`npx tsx ${workflow.path}`, {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit', // Show output in real-time
      env: process.env,
    });

    const duration = Date.now() - startTime;
    workflow.lastRun = new Date();
    workflow.lastStatus = 'success';
    workflow.executionCount++;
    delete workflow.lastError;

    success(`[${workflow.name}] Completed successfully in ${duration}ms`);
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    workflow.lastRun = new Date();
    workflow.lastStatus = 'error';
    workflow.lastError = errorMessage;
    workflow.executionCount++;

    error(`[${workflow.name}] Failed after ${duration}ms: ${errorMessage}`);
  }
}

/**
 * Health check endpoint data
 */
function getWorkerStatus() {
  return {
    uptime: process.uptime(),
    workflows: Object.entries(workflows).map(([key, workflow]) => ({
      id: key,
      name: workflow.name,
      lastRun: workflow.lastRun,
      lastStatus: workflow.lastStatus,
      executionCount: workflow.executionCount,
      lastError: workflow.lastError,
    })),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandlers(): void {
  const shutdown = (signal: string) => {
    warn(`\n${signal} received, shutting down gracefully...`);

    // Log final status
    const status = getWorkerStatus();
    log('Final worker status:');
    console.log(JSON.stringify(status, null, 2));

    // Stop all cron jobs
    cron.getTasks().forEach(task => task.stop());

    success('Worker shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Main worker initialization
 */
function startWorker(): void {
  log('🚀 FlipOps Cron Worker starting...\n');

  // Validate environment
  validateEnvironment();

  // Setup graceful shutdown
  setupShutdownHandlers();

  // Schedule all workflows
  log('📅 Scheduling workflows:\n');

  // Guardrails - Every 15 minutes
  log('⚠️  Guardrail Workflows (Every 15 minutes):');
  cron.schedule('*/15 * * * *', () => executeWorkflow('g1-deal-approval'), {
    timezone: 'UTC',
  });
  log('   ✓ G1: Deal Approval Alert');

  cron.schedule('*/15 * * * *', () => executeWorkflow('g2-bid-spread'), {
    timezone: 'UTC',
  });
  log('   ✓ G2: Bid Spread Alert');

  cron.schedule('*/15 * * * *', () => executeWorkflow('g3-invoice-budget'), {
    timezone: 'UTC',
  });
  log('   ✓ G3: Invoice & Budget Guardian');

  cron.schedule('*/15 * * * *', () => executeWorkflow('g4-change-order'), {
    timezone: 'UTC',
  });
  log('   ✓ G4: Change Order Gatekeeper\n');

  // Monitoring + Discovery jobs MIGRATED to worker-bullmq per Phase 6 of the
  // freshness layer plan (Strategy C hybrid). G1-G4 stay here (process
  // isolation via execSync is a safety guarantee we don't want to lose), but
  // the 5 daily/weekly jobs now run as BullMQ scheduled jobs in the
  // worker-bullmq Railway service. See lib/cron/worker-bullmq-monitoring.ts.
  //
  // MOVED → worker-bullmq:
  //   - data-refresh    (0 8 * * * UTC)
  //   - pipeline-monitoring (0 9 * * * UTC)
  //   - contractor-performance (0 10 * * * UTC)
  //   - skip-tracing    (0 7 * * 0 UTC)
  log('🔁 Monitoring + Discovery workflows migrated to worker-bullmq service.\n');

  success('✅ Guardrail workflows scheduled successfully!\n');

  // Log current status
  log('Worker is now running. Press Ctrl+C to stop.\n');
  log('Next scheduled executions:');
  log('  • Guardrails: Every 15 minutes (next in ~15 min)');
  log('  • Monitoring + Discovery jobs now run on worker-bullmq service\n');

  // Status update every hour
  cron.schedule('0 * * * *', () => {
    log('\n📊 Hourly Status Update:');
    const status = getWorkerStatus();
    log(`Uptime: ${Math.floor(status.uptime / 3600)}h ${Math.floor((status.uptime % 3600) / 60)}m`);
    log(`Total executions: ${status.workflows.reduce((sum, w) => sum + w.executionCount, 0)}`);

    const recentFailures = status.workflows.filter(
      w => w.lastStatus === 'error' && w.lastRun &&
      (Date.now() - new Date(w.lastRun).getTime()) < 3600000 // Last hour
    );

    if (recentFailures.length > 0) {
      warn(`⚠️  ${recentFailures.length} workflow(s) failed in the last hour`);
      recentFailures.forEach(w => {
        error(`   ${w.name}: ${w.lastError}`);
      });
    } else {
      success('✅ All workflows running smoothly');
    }
    log('');
  }, {
    timezone: 'UTC',
  });
}

// Start the worker
if (require.main === module) {
  startWorker();

  // Keep the process alive
  process.stdin.resume();
}

export { startWorker, getWorkerStatus, workflows };
