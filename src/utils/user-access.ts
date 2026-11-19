import prisma from '../config/prisma-client';
import { isAccessActive } from './access-expiration';

type AccessExpirationRow = {
  id: string;
  access_expires_at: Date | string | null;
};

let legacySchemaWarningLogged = false;

function isMissingExpirationColumnError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes('access_expires_at') && (
    message.includes('no such column') ||
    message.includes('does not exist') ||
    message.includes('unknown column')
  );
}

function normalizeExpiration(value: Date | string | null): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export async function getUserAccessExpiration(userId: string): Promise<Date | null> {
  const rows = await prisma.$queryRaw<AccessExpirationRow[]>`
    SELECT id, access_expires_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  const row = rows[0];
  return row ? normalizeExpiration(row.access_expires_at) : null;
}

export async function getUsersAccessExpirations(): Promise<AccessExpirationRow[]> {
  return prisma.$queryRaw<AccessExpirationRow[]>`
    SELECT id, access_expires_at
    FROM users
  `;
}

export async function setUserAccessExpiration(userId: string, expiresAt: Date | null): Promise<void> {
  const value = expiresAt ? expiresAt.toISOString() : null;
  await prisma.$executeRaw`
    UPDATE users
    SET access_expires_at = ${value}
    WHERE id = ${userId}
  `;
}

export async function hasActiveUserAccess(userId: string): Promise<boolean> {
  try {
    const accessExpiresAt = await getUserAccessExpiration(userId);
    return isAccessActive(accessExpiresAt);
  } catch (error) {
    if (!isMissingExpirationColumnError(error)) throw error;

    if (!legacySchemaWarningLogged) {
      console.warn(
        '[user-access] Legacy database has no users.access_expires_at; existing accounts are treated as lifetime access until the migration is safely applied.'
      );
      legacySchemaWarningLogged = true;
    }

    // Older installations predate expiration tracking. Confirm the account
    // still exists, but preserve its prior lifetime-access behavior.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return Boolean(user);
  }
}
