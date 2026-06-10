/**
 * Backup current user data before making any database changes
 * Creates timestamped JSON backup file
 */

const FO_API_BASE_URL = 'https://bb4c35d48e9c.ngrok-free.app';
const FO_API_KEY = 'fo_live_10177805c8d743e1a6e1860515dc2b3f';
const fs = require('fs');
const path = require('path');

async function backupUsers() {
  console.log('📦 Creating backup of all users...\n');

  try {
    const response = await fetch(`${FO_API_BASE_URL}/api/users`, {
      method: 'GET',
      headers: {
        'x-api-key': FO_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status}`);
    }

    const data = await response.json();
    const users = data.users || [];

    console.log(`✅ Fetched ${users.length} users from database\n`);

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../backups');
    const backupFile = path.join(backupDir, `users-backup-${timestamp}.json`);

    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Write backup file
    const backupData = {
      timestamp: new Date().toISOString(),
      userCount: users.length,
      users: users.map((user: any) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        onboarded: user.onboarded,
        minScore: user.minScore,
        investorProfile: user.investorProfile,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }))
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

    console.log(`💾 Backup saved to: ${backupFile}\n`);
    console.log('📊 Backup Summary:');
    console.log(`   Total users: ${users.length}`);
    console.log(`   File size: ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB`);
    console.log(`   Timestamp: ${timestamp}\n`);

    // Also save a copy with a simple name for easy access
    const latestBackupFile = path.join(backupDir, 'users-backup-latest.json');
    fs.writeFileSync(latestBackupFile, JSON.stringify(backupData, null, 2));
    console.log(`📝 Also saved as: ${latestBackupFile}\n`);

    // Show summary of each user
    console.log('👥 Users backed up:');
    users.forEach((user: any, i: number) => {
      const profile = typeof user.investorProfile === 'string'
        ? JSON.parse(user.investorProfile)
        : user.investorProfile;

      console.log(`   ${i + 1}. ${user.name || user.email}`);
      console.log(`      ID: ${user.id}`);
      console.log(`      Min Score: ${user.minScore || 'not set'}`);
      console.log(`      Target ZIPs: ${profile?.targetZipCodes?.length || 0}`);
      console.log(`      Onboarded: ${user.onboarded ? 'Yes' : 'No'}\n`);
    });

    console.log('✅ Backup complete! Safe to proceed with database changes.\n');

    return backupFile;
  } catch (error) {
    console.error('❌ Backup failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

backupUsers().catch(console.error);

// Treat this script as a module to avoid global-scope const collisions.
export {};
