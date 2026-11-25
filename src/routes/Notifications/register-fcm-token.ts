import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import prisma from '../../config/prisma-client';
import { hasActiveUserAccess } from '../../utils/user-access';
import isPrismaMissingTable from '../../utils/is-prisma-missing-table';

const registrationSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  token: z.string().trim().min(10).max(4096),
});

function hashKey(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function equalHashes(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export default {
  url: '/api/fcm/register',
  method: 'POST',
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = registrationSchema.safeParse(req.body);
    const suppliedKey = req.headers['x-registration-key'];

    if (!parsed.success || typeof suppliedKey !== 'string' || suppliedKey.length < 32 || suppliedKey.length > 256) {
      return reply.status(400).send({ status: 400, message: 'Dados de registro inválidos.' });
    }

    try {
      const keyHash = hashKey(suppliedKey);
      const keyRecord = await prisma.deviceRegistrationKey.findUnique({
        where: { key_hash: keyHash },
        select: { user_id: true, key_hash: true },
      });
      if (!keyRecord || !equalHashes(keyRecord.key_hash, keyHash) || keyRecord.user_id !== parsed.data.userId) {
        return reply.status(403).send({ status: 403, message: 'Registro não autorizado.' });
      }

      if (!(await hasActiveUserAccess(keyRecord.user_id))) {
        return reply.status(403).send({ status: 403, message: 'A conta não possui acesso ativo.' });
      }

      await prisma.deviceFcmToken.upsert({
        where: { token: parsed.data.token },
        create: { token: parsed.data.token, user_id: keyRecord.user_id },
        update: { user_id: keyRecord.user_id },
      });

      return reply.status(204).send();
    } catch (error) {
      if (isPrismaMissingTable(error)) {
        return reply.status(503).send({ status: 503, message: 'O registro FCM ainda não está disponível no banco do painel.' });
      }
      req.log.error('FCM device registration failed');
      return reply.status(500).send({ status: 500, message: 'Não foi possível registrar o dispositivo.' });
    }
  },
} as RouteOptions;
