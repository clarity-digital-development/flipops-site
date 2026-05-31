/* eslint-disable no-console */
import IORedis from 'ioredis';
import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error('REDIS_URL not set');
  process.exit(1);
}

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const rawRedis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const QUEUE_NAMES = ['domain-flpublicnotices', 'internal-health'];

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (err) {
    return String(obj);
  }
}

function fmtTs(ts: number | null | undefined): string {
  if (!ts) return String(ts);
  try {
    return `${ts} (${new Date(ts).toISOString()})`;
  } catch {
    return String(ts);
  }
}

async function probeQueue(name: string) {
  console.log('\n=========================================');
  console.log(`QUEUE: ${name}`);
  console.log('=========================================');

  const q = new Queue(name, { connection });

  try {
    const counts = await q.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
      'waiting-children',
    );
    console.log(`\n[${name}] getJobCounts:`);
    console.log(safeStringify(counts));
  } catch (err) {
    console.log(`[${name}] getJobCounts ERROR:`, (err as Error).message);
  }

  const states: Array<'active' | 'waiting' | 'delayed' | 'failed' | 'completed' | 'paused'> = [
    'active',
    'waiting',
    'delayed',
    'failed',
    'completed',
    'paused',
  ];

  for (const state of states) {
    try {
      const jobs = await q.getJobs([state], 0, 20);
      console.log(`\n[${name}] getJobs(${state}) count=${jobs.length}`);
      for (const j of jobs) {
        console.log('---');
        console.log(`  id=${j.id} name=${j.name}`);
        console.log(`  timestamp=${fmtTs(j.timestamp)}`);
        console.log(`  processedOn=${fmtTs(j.processedOn ?? null)}`);
        console.log(`  finishedOn=${fmtTs(j.finishedOn ?? null)}`);
        console.log(`  attemptsMade=${j.attemptsMade}`);
        console.log(`  delay=${j.delay}`);
        console.log(`  data=${safeStringify(j.data)}`);
        if (j.failedReason) console.log(`  failedReason=${j.failedReason}`);
        if (j.returnvalue !== undefined && j.returnvalue !== null) {
          console.log(`  returnvalue=${safeStringify(j.returnvalue)}`);
        }
      }
    } catch (err) {
      console.log(`[${name}] getJobs(${state}) ERROR:`, (err as Error).message);
    }
  }

  try {
    const schedulers = await q.getJobSchedulers();
    console.log(`\n[${name}] getJobSchedulers count=${schedulers.length}`);
    for (const s of schedulers) {
      console.log('---');
      console.log(safeStringify(s));
      if ((s as any).next) {
        console.log(`  next(human)=${fmtTs((s as any).next)}`);
      }
    }
  } catch (err) {
    console.log(`[${name}] getJobSchedulers ERROR:`, (err as Error).message);
  }

  if (name === 'domain-flpublicnotices') {
    try {
      const j = await q.getJob('15');
      if (!j) {
        console.log(`\n[${name}] getJob("15") => null (not found)`);
      } else {
        const state = await j.getState();
        console.log(`\n[${name}] getJob("15"):`);
        console.log(`  id=${j.id} name=${j.name}`);
        console.log(`  state=${state}`);
        console.log(`  timestamp=${fmtTs(j.timestamp)}`);
        console.log(`  processedOn=${fmtTs(j.processedOn ?? null)}`);
        console.log(`  finishedOn=${fmtTs(j.finishedOn ?? null)}`);
        console.log(`  attemptsMade=${j.attemptsMade}`);
        console.log(`  delay=${j.delay}`);
        console.log(`  data=${safeStringify(j.data)}`);
        console.log(`  failedReason=${j.failedReason ?? 'n/a'}`);
        console.log(`  returnvalue=${safeStringify(j.returnvalue)}`);
        console.log(`  opts=${safeStringify(j.opts)}`);
      }
    } catch (err) {
      console.log(`[${name}] getJob("15") ERROR:`, (err as Error).message);
    }
  }

  await q.close();
}

async function dumpRawKeys(pattern: string, limit: number) {
  console.log(`\n=========================================`);
  console.log(`RAW REDIS KEYS pattern=${pattern}`);
  console.log(`=========================================`);
  try {
    const keys = await rawRedis.keys(pattern);
    keys.sort();
    console.log(`Total keys matching: ${keys.length}`);
    const shown = keys.slice(0, limit);
    for (const k of shown) {
      try {
        const type = await rawRedis.type(k);
        let preview = '';
        if (type === 'string') {
          const v = await rawRedis.get(k);
          preview = v ?? '';
        } else if (type === 'hash') {
          const v = await rawRedis.hgetall(k);
          preview = JSON.stringify(v);
        } else if (type === 'list') {
          const v = await rawRedis.lrange(k, 0, 9);
          preview = JSON.stringify(v);
        } else if (type === 'set') {
          const v = await rawRedis.smembers(k);
          preview = JSON.stringify(v);
        } else if (type === 'zset') {
          const v = await rawRedis.zrange(k, 0, 9, 'WITHSCORES');
          preview = JSON.stringify(v);
        } else if (type === 'stream') {
          const len = await rawRedis.xlen(k);
          preview = `stream length=${len}`;
        } else {
          preview = `(type=${type})`;
        }
        if (preview.length > 800) preview = preview.slice(0, 800) + '...[truncated]';
        console.log(`KEY ${k} [${type}] => ${preview}`);
      } catch (err) {
        console.log(`KEY ${k} ERROR: ${(err as Error).message}`);
      }
    }
    if (keys.length > shown.length) {
      console.log(`...(${keys.length - shown.length} more keys not shown)`);
    }
  } catch (err) {
    console.log(`keys(${pattern}) ERROR:`, (err as Error).message);
  }
}

async function main() {
  for (const name of QUEUE_NAMES) {
    await probeQueue(name);
  }

  await dumpRawKeys('bull:domain-flpublicnotices:*', 30);
  await dumpRawKeys('bull:internal-health:*', 30);

  // Specifically inspect job 15 hash
  console.log(`\n=========================================`);
  console.log(`RAW JOB 15 HASH on domain-flpublicnotices`);
  console.log(`=========================================`);
  try {
    const h = await rawRedis.hgetall('bull:domain-flpublicnotices:15');
    console.log(safeStringify(h));
  } catch (err) {
    console.log('ERROR:', (err as Error).message);
  }

  await connection.quit();
  await rawRedis.quit();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('PROBE FAILED:', err);
    process.exit(1);
  });
