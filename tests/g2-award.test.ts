import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../lib/prisma';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('Gate G2 - Bid Award (Spread Control)', () => {
  let safeBidId: string;
  let riskyBidId: string;

  beforeAll(async () => {
    console.log('Setting up test data...');

    // Get a safe bid ID (low spread)
    const safeBid = await prisma.bid.findFirst({
      where: {
        dealId: 'SAFE_DEAL_001',
        status: 'pending'
      }
    });

    // Get a risky bid ID (high spread)
    const riskyBid = await prisma.bid.findFirst({
      where: {
        dealId: 'RISKY_DEAL_001',
        status: 'pending'
      }
    });

    if (!safeBid || !riskyBid) {
      console.warn('Test bids not found. Please run: npm run prisma:seed');
    } else {
      safeBidId = safeBid.id;
      riskyBidId = riskyBid.id;
      console.log('Test bid IDs:', { safeBidId, riskyBidId });
    }
  });

  describe('POST /api/bids/award', () => {

    it('should AWARD when bid spread is within threshold (<15%)', async () => {
      const response = await fetch(`${BASE_URL}/api/bids/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId: 'SAFE_DEAL_001',
          winningBidId: safeBidId
        })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('AWARDED');
      expect(data.dealId).toBe('SAFE_DEAL_001');
      expect(data.winningBidId).toBe(safeBidId);
      expect(data.stats).toBeDefined();
      expect(data.stats.spreadPct).toBeLessThan(15);
      expect(data.threshold).toBe(15);
      expect(data.eventId).toBeDefined();
    });

    it('should BLOCK when bid spread exceeds threshold (>15%)', async () => {
      const response = await fetch(`${BASE_URL}/api/bids/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId: 'RISKY_DEAL_001',
          winningBidId: riskyBidId
        })
      });

      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.status).toBe('BLOCKED_G2');
      expect(data.reason).toContain('spread');
      expect(data.stats).toBeDefined();
      expect(data.stats.spreadPct).toBeGreaterThan(15);
      expect(data.threshold).toBe(15);
      expect(data.outliers).toBeDefined();
      expect(data.bids).toBeDefined();
      expect(Array.isArray(data.bids)).toBe(true);
      expect(data.eventId).toBeDefined();
      expect(data.recommendation).toBeDefined();
    });

    it('should return 404 for non-existent bid', async () => {
      const response = await fetch(`${BASE_URL}/api/bids/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId: 'SAFE_DEAL_001',
          winningBidId: 'NON_EXISTENT_BID'
        })
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return 404 for bid from different deal', async () => {
      const response = await fetch(`${BASE_URL}/api/bids/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId: 'SAFE_DEAL_001',
          winningBidId: riskyBidId // This bid belongs to RISKY_DEAL_001
        })
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return 422 for missing required fields', async () => {
      const response = await fetch(`${BASE_URL}/api/bids/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId: 'SAFE_DEAL_001'
          // Missing winningBidId
        })
      });

      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toContain('Validation failed');
    });

    it('should normalize different unit formats correctly', async () => {
      // The seed data includes bids with 'square', 'sqft', and 'sf' units
      // They should all normalize correctly for comparison
      const response = await fetch(`${BASE_URL}/api/bids/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId: 'SAFE_DEAL_001',
          winningBidId: safeBidId
        })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('AWARDED');
      // The spread should be calculated correctly despite different units
      expect(data.stats.spreadPct).toBeLessThan(15);
    });
  });

  describe('Event Logging', () => {

    it('should create an event for awarded bids', async () => {
      // Get a fresh pending bid
      const freshBid = await prisma.bid.findFirst({
        where: {
          dealId: 'SAFE_DEAL_001',
          status: 'pending'
        }
      });

      if (!freshBid) return;

      const response = await fetch(`${BASE_URL}/api/bids/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId: 'SAFE_DEAL_001',
          winningBidId: freshBid.id
        })
      });

      const data = await response.json();
      expect(data.eventId).toBeDefined();

      // Verify event was created
      const event = await prisma.event.findUnique({
        where: { id: data.eventId }
      });

      expect(event).toBeDefined();
      expect(event?.action).toBe('AWARD');
      expect(event?.artifact).toBe('Bid');
      expect(event?.actor).toBe('system:G2');
    });

    it('should create an event for blocked bids', async () => {
      const response = await fetch(`${BASE_URL}/api/bids/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId: 'RISKY_DEAL_001',
          winningBidId: riskyBidId
        })
      });

      const data = await response.json();
      expect(data.eventId).toBeDefined();

      // Verify event was created
      const event = await prisma.event.findUnique({
        where: { id: data.eventId }
      });

      expect(event).toBeDefined();
      expect(event?.action).toBe('BLOCK');
      expect(event?.artifact).toBe('Bid');
      expect(event?.actor).toBe('system:G2');
    });
  });

  describe('Budget Ledger Updates', () => {

    it('should update budget ledger when bid is awarded', async () => {
      // Ensure budget ledger exists
      await prisma.budgetLedger.upsert({
        where: { dealId: 'SAFE_DEAL_001' },
        update: {},
        create: {
          dealId: 'SAFE_DEAL_001',
          // BudgetLedger stores trade maps as JSON strings
          baseline: JSON.stringify({ Roofing: 10000, total: 10000 }),
          committed: '{}',
          actuals: '{}',
          variance: '{}',
          contingencyRemaining: 1500
        }
      });

      // Get a pending bid
      const pendingBid = await prisma.bid.findFirst({
        where: {
          dealId: 'SAFE_DEAL_001',
          status: 'pending'
        }
      });

      if (!pendingBid) return;

      const response = await fetch(`${BASE_URL}/api/bids/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId: 'SAFE_DEAL_001',
          winningBidId: pendingBid.id
        })
      });

      expect(response.status).toBe(200);

      // Check ledger was updated
      const ledger = await prisma.budgetLedger.findUnique({
        where: { dealId: 'SAFE_DEAL_001' }
      });

      expect(ledger).toBeDefined();
      const committed = ledger?.committed as any;
      expect(committed.Roofing).toBeGreaterThan(0);
    });
  });
});