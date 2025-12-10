import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const org = await prisma.organization.upsert({
    where: { id: 'org_default' },
    update: {},
    create: {
      id: 'org_default',
      name: 'Default Organization',
    },
  });

  console.log(`✅ Created organization: ${org.name}`);

  // Hash passwords
  const passwordHash = await bcrypt.hash('password123', 10);

  const adminUser = await prisma.user.upsert({
    where: { id: 'user_admin' },
    update: {
      role: UserRole.OWNER,
      passwordHash,
    },
    create: {
      id: 'user_admin',
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash,
      organizationId: org.id,
      role: UserRole.OWNER,
    },
  });

  console.log(`✅ Created owner user: ${adminUser.email} (password: password123)`);

  const memberUser = await prisma.user.upsert({
    where: { id: 'user_member' },
    update: {
      passwordHash,
    },
    create: {
      id: 'user_member',
      email: 'member@example.com',
      name: 'Member User',
      passwordHash,
      organizationId: org.id,
      role: UserRole.MEMBER,
    },
  });

  console.log(`✅ Created member user: ${memberUser.email} (password: password123)`);

  // Create Default team
  const defaultTeam = await prisma.team.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: 'Default'
      }
    },
    update: {
      isDefault: true,
      primaryContactId: adminUser.id
    },
    create: {
      name: 'Default',
      organizationId: org.id,
      isDefault: true,
      primaryContactId: adminUser.id,
      members: {
        create: [
          { userId: adminUser.id },
          { userId: memberUser.id }
        ]
      }
    }
  });

  console.log(`✅ Created default team: ${defaultTeam.name}`);

  console.log('🎉 Seeding complete!');
  console.log('');
  console.log('You can now log in with:');
  console.log('  Email: admin@example.com');
  console.log('  Password: password123');
  console.log('  Role: OWNER');
  console.log('');
  console.log('Or:');
  console.log('  Email: member@example.com');
  console.log('  Password: password123');
  console.log('  Role: MEMBER');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
