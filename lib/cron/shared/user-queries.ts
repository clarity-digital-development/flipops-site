/**
 * Shared user and data query utilities for cron jobs
 * Common Prisma queries used across multiple workflows
 */

import { randomUUID } from 'crypto';
import { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// NOTE: Use shared prisma singleton - do NOT create new PrismaClient instances

export interface ActiveUser extends User {
  // Add any computed fields here if needed
}

/**
 * Get all active users (excludes System Default)
 */
export async function getActiveUsers(): Promise<ActiveUser[]> {
  const users = await prisma.user.findMany({
    where: {
      AND: [
        {
          OR: [
            { subscriptionStatus: 'active' },
            { subscriptionStatus: 'trial' },
          ],
        },
        {
          name: {
            not: 'System Default',
          },
        },
      ],
    },
    orderBy: {
      name: 'asc',
    },
  });

  return users;
}

/**
 * Get a single user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  return await prisma.user.findUnique({
    where: { id: userId },
  });
}

/**
 * Get users with Slack webhooks configured
 */
export async function getUsersWithSlackWebhooks(): Promise<User[]> {
  const users = await getActiveUsers();
  return users.filter((user) => user.slackWebhook !== null);
}

/**
 * Parse investor profile JSON safely
 */
export function parseInvestorProfile(user: User): any {
  if (!user.investorProfile) {
    return null;
  }

  try {
    if (typeof user.investorProfile === 'string') {
      return JSON.parse(user.investorProfile);
    }
    return user.investorProfile;
  } catch (error) {
    console.error(`Failed to parse investor profile for user ${user.id}:`, error);
    return null;
  }
}

/**
 * Get active deals for a user
 */
export async function getActiveDeals(userId: string) {
  return await prisma.dealSpec.findMany({
    where: {
      userId,
      // Add active deal criteria here
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get properties needing skip trace
 */
export async function getPropertiesNeedingSkipTrace(
  limit: number = 25,
  minScore: number = 70
) {
  return await prisma.property.findMany({
    where: {
      score: {
        gte: minScore,
      },
      enriched: false,
    },
    take: limit,
    orderBy: {
      score: 'desc',
    },
  });
}

/**
 * Batch update properties
 */
export async function updatePropertiesBatch(
  updates: Array<{ id: string; data: any }>
): Promise<number> {
  let count = 0;

  for (const update of updates) {
    try {
      await prisma.property.update({
        where: { id: update.id },
        data: update.data,
      });
      count++;
    } catch (error) {
      console.error(`Failed to update property ${update.id}:`, error);
    }
  }

  return count;
}

/**
 * Create notification record
 */
export async function createNotification(data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
}) {
  return await prisma.notification.create({
    data: {
      eventId: randomUUID(),
      userId: data.userId,
      type: data.type,
      // Notification has no separate title column — fold it into the message.
      message: data.title ? `${data.title}: ${data.message}` : data.message,
      metadata: JSON.stringify(data.metadata ?? {}),
    },
  });
}

/**
 * Cleanup: Close Prisma connection
 * WARNING: Only call this when running as a standalone process (scripts)
 * NEVER call this from API routes or shared code paths
 */
export async function closePrismaConnection() {
  // Only disconnect if running as standalone script, not in API routes
  if (process.env.STANDALONE_SCRIPT === 'true') {
    await prisma.$disconnect();
  }
}

export { prisma };
