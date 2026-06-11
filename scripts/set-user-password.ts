/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// set-user-password.ts — issue (or rotate) a user's credentials password.
//
// M2.5 manual-creation policy: there is NO self-serve signup. Users are
// created manually/programmatically, then issued a password with this script.
// The Auth.js Credentials provider (auth.ts) rejects users whose passwordHash
// is NULL, so running this is the final activation step for an account.
//
// Usage:
//   npx tsx scripts/set-user-password.ts --email user@example.com --password 'S3cret!'
//   npx tsx scripts/set-user-password.ts --email user@example.com --generate
//
// Behavior:
//   - Email is normalized to lowercase (the sign-in form lowercases input too).
//   - Upserts the User row: existing row gets passwordHash updated; missing
//     row is CREATED (with required targetMarkets default) then given the
//     hash — i.e. this script can both provision and credential a user.
//   - bcrypt cost factor 12.
//   - --generate prints the random password ONCE; store it or rotate after
//     first login.
// ---------------------------------------------------------------------------

import { config } from "dotenv";
config({ path: ".env.local" });

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function parseArgs(argv: string[]): { email?: string; password?: string; generate: boolean } {
  const out: { email?: string; password?: string; generate: boolean } = { generate: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email") out.email = argv[++i];
    else if (arg === "--password") out.password = argv[++i];
    else if (arg === "--generate") out.generate = true;
  }
  return out;
}

/** URL-safe random password, ~96 bits of entropy. */
function generatePassword(): string {
  return randomBytes(12).toString("base64url");
}

async function main() {
  const { email: rawEmail, password: givenPassword, generate } = parseArgs(process.argv.slice(2));

  if (!rawEmail) {
    console.error(
      "Usage: npx tsx scripts/set-user-password.ts --email <email> (--password <password> | --generate)"
    );
    process.exit(1);
  }

  const email = rawEmail.trim().toLowerCase();
  const password = givenPassword ?? (generate ? generatePassword() : undefined);

  if (!password) {
    console.error("Provide --password <password> or --generate.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      passwordHash,
      targetMarkets: "[]", // required column; user fills in via onboarding
    },
    select: { id: true, email: true, createdAt: true, updatedAt: true },
  });

  console.log(`\nPassword set for ${user.email} (User.id ${user.id}).`);
  if (!givenPassword) {
    console.log(`\nGenerated password (shown ONCE — rotate after first login):\n\n  ${password}\n`);
  }
}

main()
  .catch((err) => {
    console.error("set-user-password failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
