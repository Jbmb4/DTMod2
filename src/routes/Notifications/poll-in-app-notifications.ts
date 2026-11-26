import { createHash, timingSafeEqual } from 'node:crypto';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import prisma from '../../config/prisma-client';
import { hasActiveUserAccess } from '../../utils/user-access';
import isPrismaMissingTable from '../../utils/is-prisma-missing-table';

const PAGE_SIZE = 25;
function hashKey(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
function equalHashes(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export default {
  url: '/api/notifications/poll',
  method: 'GET',
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const suppliedKey = req.headers['x-registration-key'];
    const suppliedUserId = req.headers['x-user-id'];
    const rawAfter = (req.query as { after?: string }).after ?? '0';
    const bootstrap = rawAfter === 'latest';
    const after = /^\d{1,10}$/.test(rawAfter) ? Number(rawAfter) : bootstrap ? 0 : NaN;
    if (
      typeof suppliedKey !== 'string' ||
      suppliedKey.length < 32 ||
      suppliedKey.length > 256 ||
      typeof suppliedUserId !== 'string' ||
      suppliedUserId.length < 1 ||
      suppliedUserId.length > 128 ||
      !Number.isSafeInteger(after) ||
      after < 0
    ) {
      return reply.status(400).send({ status: 400, message: 'Cursor ou credencial inválida.' });
    }

    try {
      const keyHash = hashKey(suppliedKey);
      const keyRecord = await prisma.deviceRegistrationKey.findUnique({
        where: { key_hash: keyHash },
        select: { key_hash: true, user_id: true },
      });
      if (
        !keyRecord ||
        !equalHashes(keyRecord.key_hash, keyHash) ||
        keyRecord.user_id !== suppliedUserId ||
        !(await hasActiveUserAccess(keyRecord.user_id))
      ) {
        return reply.status(403).send({ status: 403, message: 'Aplicativo não autorizado ou conta sem acesso ativo.' });
      }

      if (bootstrap) {
        const latest = await prisma.inAppNotification.aggregate({
          where: { user_id: keyRecord.user_id },
          _max: { id: true },
        });
        return reply.send({ notifications: [], nextCursor: latest._max.id ?? 0, hasMore: false });
      }

      const rows = await prisma.inAppNotification.findMany({
        where: { user_id: keyRecord.user_id, id: { gt: after } },
        orderBy: { id: 'asc' },
        take: PAGE_SIZE + 1,
        select: { id: true, title: true, message: true, image_url: true, created_at: true },
      });
      const hasMore = rows.length > PAGE_SIZE;
      const notifications = rows.slice(0, PAGE_SIZE).map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        imageUrl: row.image_url,
        createdAt: row.created_at,
      }));
      return reply.send({ notifications, nextCursor: notifications.at(-1)?.id ?? after, hasMore });
    } catch (error) {
      if (isPrismaMissingTable(error)) {
        return reply
          .status(503)
          .send({ status: 503, message: 'A caixa de mensagens ainda não está disponível no banco do painel.' });
      }
      req.log.error('In-app notification polling failed');
      return reply.status(500).send({ status: 500, message: 'Não foi possível consultar as mensagens.' });
    }
  },
} as RouteOptions;
