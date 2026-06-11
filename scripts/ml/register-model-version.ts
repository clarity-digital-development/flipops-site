/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// M2.4 — Register a trained model in the ModelVersion registry (README step 4).
//
//   DATABASE_URL=... npx tsx scripts/ml/register-model-version.ts \
//     --metrics scripts/ml/out/model-v1/metrics.json \
//     [--promote] [--notes "first training run, Miami-Dade+Broward frame"]
//
// Reads metrics.json verbatim from train_propensity.py and inserts a row with
// the next version number for its modelKey. --promote flips the new row to
// promoted=true AND demotes every other version of the same modelKey (at most
// ONE promoted version per modelKey — SCORING-ARCHITECTURE invariant #1/#2).
// Pass --promote ONLY after the eval gates pass (README step 3):
//   1. auc > baselineAuc (assessed-ratio floor)
//   2. calibration-by-decile sane (observed roughly monotone, no >2x inversion)
//   3. auc > incumbent promoted version's auc (skip for the first version)
// ---------------------------------------------------------------------------

import * as fs from "fs";
// Relative import (not "@/lib/prisma") so a standalone `tsc --noEmit` on this
// file resolves without the Next.js path-alias config. Same singleton.
import { prisma } from "../../lib/prisma";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const metricsPath = get("--metrics");
  const promote = argv.includes("--promote");
  const notes = get("--notes") ?? null;
  if (!metricsPath) {
    console.error(
      "usage: npx tsx scripts/ml/register-model-version.ts --metrics <metrics.json> [--promote] [--notes <text>]",
    );
    process.exit(1);
  }

  const metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
  const modelKey: string = metrics.modelKey;
  const featureList: string[] = metrics.featureList;
  if (!modelKey || !Array.isArray(featureList)) {
    console.error("[register] metrics.json missing modelKey/featureList — not a train_propensity.py artifact?");
    process.exit(2);
  }

  const result = await prisma.$transaction(async (tx) => {
    const prev = await tx.modelVersion.findFirst({
      where: { modelKey },
      orderBy: { version: "desc" },
    });
    const version = (prev?.version ?? 0) + 1;

    // Incumbent gate (#3): warn loudly when promoting over a better incumbent.
    const incumbent = await tx.modelVersion.findFirst({ where: { modelKey, promoted: true } });
    if (promote && incumbent) {
      const incumbentAuc = Number((incumbent.metrics as Record<string, unknown>)?.auc ?? NaN);
      if (Number.isFinite(incumbentAuc) && !(metrics.auc > incumbentAuc)) {
        throw new Error(
          `refusing to promote: auc=${metrics.auc} does not beat incumbent v${incumbent.version} auc=${incumbentAuc}`,
        );
      }
      await tx.modelVersion.updateMany({ where: { modelKey }, data: { promoted: false } });
    }

    return tx.modelVersion.create({
      data: {
        modelKey,
        version,
        trainedAt: metrics.trainedAt ? new Date(metrics.trainedAt) : new Date(),
        metrics,
        featureList,
        promoted: promote,
        notes,
      },
    });
  });

  console.log(
    `[register] ModelVersion id=${result.id} modelKey=${result.modelKey} version=${result.version} ` +
      `promoted=${result.promoted} auc=${metrics.auc?.toFixed?.(4)} baselineAuc=${metrics.baselineAuc?.toFixed?.(4)}`,
  );
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    prisma.$disconnect().finally(() => process.exit(1));
  });
}
