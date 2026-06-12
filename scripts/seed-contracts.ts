import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sample property addresses for realistic data
const PROPERTIES = [
  { address: "123 Oak Street", city: "Jacksonville", state: "FL", zip: "32204" },
  { address: "456 Palm Avenue", city: "Jacksonville", state: "FL", zip: "32205" },
  { address: "789 Riverside Drive", city: "Jacksonville", state: "FL", zip: "32207" },
  { address: "321 Beach Boulevard", city: "Jacksonville Beach", state: "FL", zip: "32250" },
  { address: "555 Baymeadows Road", city: "Jacksonville", state: "FL", zip: "32256" },
  { address: "888 San Marco Blvd", city: "Jacksonville", state: "FL", zip: "32207" },
  { address: "222 Murray Hill Road", city: "Jacksonville", state: "FL", zip: "32205" },
  { address: "444 Ortega Boulevard", city: "Jacksonville", state: "FL", zip: "32210" },
  { address: "666 Mandarin Road", city: "Jacksonville", state: "FL", zip: "32223" },
  { address: "777 Arlington Road", city: "Jacksonville", state: "FL", zip: "32211" },
  { address: "999 Southside Blvd", city: "Jacksonville", state: "FL", zip: "32256" },
  { address: "111 Avondale Avenue", city: "Jacksonville", state: "FL", zip: "32205" },
];

// Recent leads for dashboard KPIs (shows up in 24h/7d stats)
const RECENT_LEADS = [
  // Today's leads (hot leads with high scores)
  { address: "1501 Sunset Drive", city: "Jacksonville", state: "FL", zip: "32207", hoursAgo: 2, score: 92, enriched: true, ownerName: "Michael Thompson", contacted: false },
  { address: "1502 Morning Star Lane", city: "Jacksonville", state: "FL", zip: "32205", hoursAgo: 5, score: 88, enriched: true, ownerName: "Sarah Williams", contacted: true },
  { address: "1503 Maple Court", city: "Jacksonville", state: "FL", zip: "32204", hoursAgo: 12, score: 78, enriched: false, ownerName: null, contacted: false },
  // Yesterday's leads
  { address: "1504 Cedar Way", city: "Jacksonville", state: "FL", zip: "32210", hoursAgo: 28, score: 95, enriched: true, ownerName: "David Martinez", contacted: false },
  { address: "1505 Pine Ridge Road", city: "Jacksonville", state: "FL", zip: "32223", hoursAgo: 36, score: 72, enriched: true, ownerName: "Jennifer Brown", contacted: true },
  // 2-4 days ago
  { address: "1506 Willow Creek", city: "Jacksonville", state: "FL", zip: "32211", hoursAgo: 52, score: 86, enriched: true, ownerName: "Robert Johnson", contacted: false },
  { address: "1507 Elm Street", city: "Jacksonville", state: "FL", zip: "32256", hoursAgo: 68, score: 67, enriched: false, ownerName: null, contacted: false },
  { address: "1508 Birch Lane", city: "Jacksonville Beach", state: "FL", zip: "32250", hoursAgo: 76, score: 91, enriched: true, ownerName: "Lisa Anderson", contacted: true },
  // 5-7 days ago
  { address: "1509 Aspen Court", city: "Jacksonville", state: "FL", zip: "32207", hoursAgo: 100, score: 82, enriched: true, ownerName: "James Wilson", contacted: false },
  { address: "1510 Redwood Drive", city: "Jacksonville", state: "FL", zip: "32205", hoursAgo: 130, score: 75, enriched: true, ownerName: "Emily Davis", contacted: true },
  { address: "1511 Spruce Avenue", city: "Jacksonville", state: "FL", zip: "32204", hoursAgo: 150, score: 89, enriched: true, ownerName: "Chris Taylor", contacted: false },
  { address: "1512 Magnolia Blvd", city: "Jacksonville", state: "FL", zip: "32210", hoursAgo: 168, score: 94, enriched: true, ownerName: "Amanda Clark", contacted: false },
];

// Tasks for the dashboard
const TASK_CONFIGS = [
  // Overdue tasks (will show in overdue count)
  { title: "Call back motivated seller - Cedar Way", type: "call", priority: "high", daysAgo: 2, completed: false },
  { title: "Send offer to 321 Beach Blvd owner", type: "offer", priority: "high", daysAgo: 1, completed: false },
  { title: "Review title report for Riverside property", type: "document", priority: "medium", daysAgo: 3, completed: false },
  // Due today (action items)
  { title: "Schedule property inspection - Sunset Drive", type: "inspection", priority: "high", daysAgo: 0, completed: false },
  { title: "Follow up with contractor on rehab estimate", type: "call", priority: "medium", daysAgo: 0, completed: false },
  // Completed today (shows in completed count)
  { title: "Submit earnest money deposit", type: "payment", priority: "high", daysAgo: 0, completed: true },
  { title: "Update CRM notes for Martinez property", type: "admin", priority: "low", daysAgo: 0, completed: true },
  { title: "Send DocuSign to seller", type: "document", priority: "high", daysAgo: 0, completed: true },
];

// Contract statuses with realistic distribution
const CONTRACT_CONFIGS = [
  // Pending contracts (3)
  { status: "pending", daysAgo: 2, purchasePrice: 185000 },
  { status: "pending", daysAgo: 5, purchasePrice: 225000 },
  { status: "pending", daysAgo: 1, purchasePrice: 165000 },

  // Signed contracts (2)
  { status: "signed", daysAgo: 8, purchasePrice: 195000, signedDaysAgo: 3 },
  { status: "signed", daysAgo: 12, purchasePrice: 275000, signedDaysAgo: 5 },

  // In Escrow (3)
  { status: "escrow", daysAgo: 18, purchasePrice: 210000, signedDaysAgo: 14, escrowDaysAgo: 7, closingDaysFromNow: 12 },
  { status: "escrow", daysAgo: 25, purchasePrice: 315000, signedDaysAgo: 20, escrowDaysAgo: 10, closingDaysFromNow: 5 },
  { status: "escrow", daysAgo: 22, purchasePrice: 178000, signedDaysAgo: 18, escrowDaysAgo: 8, closingDaysFromNow: 8 },

  // Closed contracts (4) - some this month, some last month
  { status: "closed", daysAgo: 45, purchasePrice: 245000, signedDaysAgo: 40, escrowDaysAgo: 30, closedDaysAgo: 5 },
  { status: "closed", daysAgo: 60, purchasePrice: 289000, signedDaysAgo: 55, escrowDaysAgo: 45, closedDaysAgo: 15 },
  { status: "closed", daysAgo: 75, purchasePrice: 198000, signedDaysAgo: 70, escrowDaysAgo: 55, closedDaysAgo: 35 },
  { status: "closed", daysAgo: 30, purchasePrice: 265000, signedDaysAgo: 25, escrowDaysAgo: 18, closedDaysAgo: 2 },
];

function daysAgoDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function hoursAgoDate(hours: number): Date {
  const date = new Date();
  date.setTime(date.getTime() - hours * 60 * 60 * 1000);
  return date;
}

function daysFromNowDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function main() {
  console.log('Seeding contracts data...');

  // Get the specific test user account (not the admin account with real data)
  let user = await prisma.user.findFirst({
    where: { email: 'tanner@claritydigital.dev' }
  });

  if (user) {
    // Clean up existing seeded data
    console.log('Cleaning up existing seeded contracts...');

    // Delete contracts and related data for seed-script properties
    const seedProperties = await prisma.property.findMany({
      where: { userId: user.id, dataSource: 'seed-script' },
      select: { id: true }
    });

    if (seedProperties.length > 0) {
      const propertyIds = seedProperties.map(p => p.id);

      // Delete rentals
      await prisma.rental.deleteMany({
        where: { propertyId: { in: propertyIds } }
      });

      // Get contracts to delete their assignments and dealSpecs
      const contracts = await prisma.contract.findMany({
        where: { propertyId: { in: propertyIds } },
        select: { id: true }
      });
      const contractIds = contracts.map(c => c.id);

      // Delete contract assignments
      await prisma.contractAssignment.deleteMany({
        where: { contractId: { in: contractIds } }
      });

      // Delete dealSpecs linked to contracts
      await prisma.dealSpec.deleteMany({
        where: { contractId: { in: contractIds } }
      });

      // Delete contracts
      await prisma.contract.deleteMany({
        where: { propertyId: { in: propertyIds } }
      });

      // Delete offers
      await prisma.offer.deleteMany({
        where: { propertyId: { in: propertyIds } }
      });

      // Delete properties
      await prisma.property.deleteMany({
        where: { id: { in: propertyIds } }
      });

      console.log(`Cleaned up ${seedProperties.length} seeded properties and related data.`);
    }
  }

  if (!user) {
    console.log('No user found for tanner@claritydigital.dev, creating...');
    user = await prisma.user.create({
      data: {
        email: 'tanner@claritydigital.dev',
        name: 'Tanner (Test Account)',
        targetMarkets: JSON.stringify(['Jacksonville, FL']),
      }
    });
    console.log(`Created test user: ${user.id}`);
  } else {
    console.log(`Using existing user: ${user.id} (${user.email})`);
  }

  // Create a buyer for some contracts to have assignments
  let buyer = await prisma.buyer.findFirst({ where: { userId: user.id } });

  if (!buyer) {
    buyer = await prisma.buyer.create({
      data: {
        userId: user.id,
        name: "Cash Flow Investments LLC",
        email: "deals@cashflowinv.com",
        phone: "(904) 555-1234",
        company: "Cash Flow Investments",
        cashBuyer: true,
        reliability: "reliable",
        dealsClosed: 12,
        totalRevenue: 125000,
        notes: "Quick closer, always funds on time",
      }
    });
    console.log(`Created buyer: ${buyer.id}`);
  }

  // Create a second buyer
  let buyer2 = await prisma.buyer.findFirst({
    where: {
      userId: user.id,
      name: { not: buyer.name }
    }
  });

  if (!buyer2) {
    buyer2 = await prisma.buyer.create({
      data: {
        userId: user.id,
        name: "Coastal Properties Group",
        email: "acquisitions@coastalpg.com",
        phone: "(904) 555-5678",
        company: "Coastal Properties",
        cashBuyer: true,
        reliability: "reliable",
        dealsClosed: 8,
        totalRevenue: 78000,
        notes: "Prefers properties under $250K",
      }
    });
    console.log(`Created buyer2: ${buyer2.id}`);
  }

  // Create properties, leads, offers, and contracts
  for (let i = 0; i < CONTRACT_CONFIGS.length; i++) {
    const config = CONTRACT_CONFIGS[i];
    const propertyData = PROPERTIES[i % PROPERTIES.length];

    console.log(`\nCreating contract ${i + 1}/${CONTRACT_CONFIGS.length}: ${propertyData.address}`);

    // Create property
    const property = await prisma.property.create({
      data: {
        userId: user.id,
        address: propertyData.address,
        city: propertyData.city,
        state: propertyData.state,
        zip: propertyData.zip,
        propertyType: "Single Family",
        bedrooms: 3 + Math.floor(Math.random() * 2),
        bathrooms: 2,
        squareFeet: 1200 + Math.floor(Math.random() * 800),
        yearBuilt: 1970 + Math.floor(Math.random() * 40),
        estimatedValue: config.purchasePrice * (1.1 + Math.random() * 0.2),
        dataSource: "seed-script",
        createdAt: daysAgoDate(config.daysAgo + 10),
      }
    });
    console.log(`  Created property: ${property.id}`);

    // Create offer
    const offer = await prisma.offer.create({
      data: {
        userId: user.id,
        propertyId: property.id,
        amount: config.purchasePrice,
        status: "accepted",
        terms: "cash",
        notes: "Standard terms, 30 day close",
        createdAt: daysAgoDate(config.daysAgo + 2),
      }
    });
    console.log(`  Created offer: ${offer.id}`);

    // Create contract
    const contract = await prisma.contract.create({
      data: {
        userId: user.id,
        propertyId: property.id,
        offerId: offer.id,
        purchasePrice: config.purchasePrice,
        status: config.status,
        signedAt: config.signedDaysAgo ? daysAgoDate(config.signedDaysAgo) : null,
        escrowOpenedAt: config.escrowDaysAgo ? daysAgoDate(config.escrowDaysAgo) : null,
        closingDate: config.closingDaysFromNow ? daysFromNowDate(config.closingDaysFromNow) :
                     config.closedDaysAgo ? daysAgoDate(config.closedDaysAgo) : null,
        closedAt: config.closedDaysAgo ? daysAgoDate(config.closedDaysAgo) : null,
        notes: config.status === "closed" ? "Closed successfully" :
               config.status === "escrow" ? "Title clear, awaiting closing" :
               config.status === "signed" ? "Awaiting earnest money deposit" : null,
        createdAt: daysAgoDate(config.daysAgo),
        updatedAt: config.closedDaysAgo ? daysAgoDate(config.closedDaysAgo) :
                   config.escrowDaysAgo ? daysAgoDate(config.escrowDaysAgo) :
                   config.signedDaysAgo ? daysAgoDate(config.signedDaysAgo) :
                   daysAgoDate(config.daysAgo),
      }
    });
    console.log(`  Created contract: ${contract.id} (${config.status})`);

    // Add assignment to some closed contracts
    if (config.status === "closed" && i % 2 === 0) {
      const selectedBuyer = i % 4 === 0 ? buyer : buyer2;
      const assignmentFee = 8000 + Math.floor(Math.random() * 7000);

      await prisma.contractAssignment.create({
        data: {
          contractId: contract.id,
          buyerId: selectedBuyer!.id,
          assignmentFee: assignmentFee,
          status: "completed",
          assignmentDate: daysAgoDate(config.closedDaysAgo! + 5),
          feeReceived: true,
          feeReceivedDate: daysAgoDate(config.closedDaysAgo!),
        }
      });
      console.log(`  Created assignment to ${selectedBuyer!.name} ($${assignmentFee})`);
    }

    // Add renovation to one closed contract
    if (config.status === "closed" && i === 9) {
      await prisma.dealSpec.create({
        data: {
          userId: user.id,
          address: `${property.address}, ${property.city}, ${property.state} ${property.zip}`,
          type: "SFH",
          contractId: contract.id,
          maxExposureUsd: 45000,
          targetRoiPct: 20,
          arv: config.purchasePrice * 1.35,
          region: "Jacksonville",
          grade: "Standard",
          status: "planning",
          constraints: JSON.stringify({ maxDaysToClose: 90 }),
        }
      });
      console.log(`  Created renovation project`);
    }

    // Add rental to one closed contract
    if (config.status === "closed" && i === 10) {
      await prisma.rental.create({
        data: {
          userId: user.id,
          propertyId: property.id,
          contractId: contract.id,
          address: `${property.address}, ${property.city}, ${property.state} ${property.zip}`,
          monthlyRent: 1850,
          deposit: 1850,
          purchasePrice: config.purchasePrice,
          mortgagePayment: 1200,
          propertyTax: 250,
          insurance: 150,
          status: "vacant",
          totalIncome: 0,
          totalExpenses: 0,
        }
      });
      console.log(`  Created rental property`);
    }
  }

  // ==========================================
  // SEED RECENT LEADS (for dashboard KPIs)
  // ==========================================
  console.log('\n--- Seeding Recent Leads for Dashboard ---');

  // First, clean up old recent leads
  await prisma.property.deleteMany({
    where: {
      userId: user.id,
      dataSource: 'seed-recent',
    },
  });

  for (const lead of RECENT_LEADS) {
    const createdAt = hoursAgoDate(lead.hoursAgo);
    const property = await prisma.property.create({
      data: {
        userId: user.id,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        propertyType: "Single Family",
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1400 + Math.floor(Math.random() * 600),
        yearBuilt: 1975 + Math.floor(Math.random() * 30),
        estimatedValue: 180000 + Math.floor(Math.random() * 120000),
        score: lead.score,
        enriched: lead.enriched,
        ownerName: lead.ownerName,
        lastContactDate: lead.contacted ? hoursAgoDate(lead.hoursAgo - 2) : null,
        dataSource: "seed-recent",
        createdAt: createdAt,
        updatedAt: createdAt,
      },
    });
    console.log(`  Created lead: ${lead.address} (score: ${lead.score}, ${lead.hoursAgo}h ago)`);
  }

  // ==========================================
  // SEED TASKS (for dashboard action items)
  // ==========================================
  console.log('\n--- Seeding Tasks for Dashboard ---');

  // Clean up old seeded tasks
  await prisma.task.deleteMany({
    where: {
      userId: user.id,
      title: { startsWith: 'Call back motivated seller' },
    },
  });
  await prisma.task.deleteMany({
    where: {
      userId: user.id,
      title: { contains: 'seed' },
    },
  });
  // Delete tasks created by this script (by title patterns)
  const taskTitles = TASK_CONFIGS.map(t => t.title);
  await prisma.task.deleteMany({
    where: {
      userId: user.id,
      title: { in: taskTitles },
    },
  });

  const recentLeadProperty = await prisma.property.findFirst({
    where: { userId: user.id, dataSource: 'seed-recent' },
  });

  for (const taskConfig of TASK_CONFIGS) {
    const dueDate = taskConfig.daysAgo !== undefined
      ? daysAgoDate(taskConfig.daysAgo)
      : daysFromNowDate(0);

    await prisma.task.create({
      data: {
        userId: user.id,
        propertyId: recentLeadProperty?.id || null,
        title: taskConfig.title,
        type: taskConfig.type,
        priority: taskConfig.priority,
        dueDate: dueDate,
        completed: taskConfig.completed,
        completedAt: taskConfig.completed ? new Date() : null,
      },
    });
    console.log(`  Created task: ${taskConfig.title} (${taskConfig.completed ? 'completed' : 'pending'})`);
  }

  // Summary
  const contractCounts = await prisma.contract.groupBy({
    by: ['status'],
    where: { userId: user.id },
    _count: true,
  });

  const recentLeadCount = await prisma.property.count({
    where: { userId: user.id, dataSource: 'seed-recent' },
  });

  const hotLeadCount = await prisma.property.count({
    where: { userId: user.id, score: { gte: 85 } },
  });

  const taskCounts = await prisma.task.groupBy({
    by: ['completed'],
    where: { userId: user.id },
    _count: true,
  });

  const overdueTaskCount = await prisma.task.count({
    where: {
      userId: user.id,
      completed: false,
      dueDate: { lt: new Date() },
    },
  });

  console.log('\n========================================');
  console.log('Seeding complete!');
  console.log('========================================');
  console.log('\nContracts by status:');
  contractCounts.forEach(c => {
    console.log(`  ${c.status}: ${c._count}`);
  });
  console.log(`\nRecent leads (7 days): ${recentLeadCount}`);
  console.log(`Hot leads (score >= 85): ${hotLeadCount}`);
  console.log(`\nTasks:`);
  taskCounts.forEach(t => {
    console.log(`  ${t.completed ? 'Completed' : 'Pending'}: ${t._count}`);
  });
  console.log(`  Overdue: ${overdueTaskCount}`);
  console.log('\n========================================');
  console.log('Dashboard should now show real data!');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Error seeding contracts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
