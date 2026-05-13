import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const passwordHash = await bcrypt.hash('password', 10);

  // Create a test user
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      passwordHash,
    },
  });

  // Create a sample folder
  const folder = await prisma.folder.create({
    data: {
      name: 'Sample Folder',
      userId: user.id,
    },
  });

  // Create a sample file metadata (does not upload to S3)
  const file = await prisma.file.create({
    data: {
      name: 'welcome.txt',
      s3Key: `${user.id}/welcome/${'welcome.txt'}`,
      mimeType: 'text/plain',
      sizeBytes: BigInt(12),
      instanceId: process.env.INSTANCE_ID || 'backend-1',
      userId: user.id,
      folderId: folder.id,
    },
  });

  console.log('Seed completed:', { user: { id: user.id, email: user.email }, folder: { id: folder.id }, file: { id: file.id } });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error', e);
    await prisma.$disconnect();
    process.exit(1);
  });
