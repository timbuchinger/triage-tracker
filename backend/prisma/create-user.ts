#!/usr/bin/env ts-node
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function helpAndExit() {
  console.log(`Usage: npx ts-node prisma/create-user.ts --email EMAIL --password PASSWORD [--name NAME] [--role OWNER|MEMBER] [--organizationId ORG_ID]`);
  process.exit(1);
}

async function main() {
  const email = getArg('email');
  const password = getArg('password');
  const name = getArg('name') || undefined;
  const roleArg = (getArg('role') || 'MEMBER').toUpperCase();
  const organizationId = getArg('organizationId') || 'org_default';

  if (!email || !password) {
    console.error('Missing required arguments.');
    helpAndExit();
  }

  const role = roleArg === 'OWNER' ? UserRole.OWNER : UserRole.MEMBER;

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        passwordHash,
        organizationId,
        role,
      },
      create: {
        email,
        name,
        passwordHash,
        organizationId,
        role,
      },
    });

    console.log(`✅ User created/updated: ${user.email} (id: ${user.id})`);
  } catch (err) {
    console.error('Failed to create user:', err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
