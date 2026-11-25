import prisma from '../config/prisma-client';

/**
 * Mantém disponíveis as tabelas usadas pelo registro FCM dos APKs.
 * CREATE IF NOT EXISTS é restrito a essas tabelas e não altera nem apaga dados.
 */
export async function ensureDeviceRegistrationKeySchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "device_registration_keys" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "key_hash" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "device_registration_keys_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "device_registration_keys_key_hash_key" ON "device_registration_keys"("key_hash")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "device_registration_keys_user_id_idx" ON "device_registration_keys"("user_id")'
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "device_fcm_tokens" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "token" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "device_fcm_tokens_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "device_fcm_tokens_token_key" ON "device_fcm_tokens"("token")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "device_fcm_tokens_user_id_idx" ON "device_fcm_tokens"("user_id")'
  );
}
