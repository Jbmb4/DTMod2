import { z } from 'zod';
import Authentication from '../../middlewares/authentication';
import csrfProtection from '../../utils/csrf-protection';
import prisma from '../../config/prisma-client';
import { sendFirebaseNotification } from '../../services/firebase-messaging';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import isPrismaMissingTable from '../../utils/is-prisma-missing-table';

const notificationSchema = z.object({
  title: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(2000),
  imageUrl: z.string().trim().max(2048).optional().default(''),
});

export default {
  url: '/notifications/send',
  method: 'POST',
  onRequest: [csrfProtection, Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = notificationSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.header('csrf-token', req.csrfProtection.generateCsrf());
      return reply.status(400).send({
        status: 400,
        message: 'Confira o título, a mensagem e a URL da imagem.',
      });
    }

    if (parsed.data.imageUrl) {
      try {
        const imageUrl = new URL(parsed.data.imageUrl);
        if (imageUrl.protocol !== 'https:') throw new Error('URL insegura');
      } catch {
        reply.header('csrf-token', req.csrfProtection.generateCsrf());
        return reply.status(400).send({ status: 400, message: 'A URL da imagem precisa ser HTTPS válida.' });
      }
    }

    let devices: Array<{ token: string }>;
    try {
      devices = await prisma.deviceFcmToken.findMany({
        where: { user_id: req.user.id },
        select: { token: true },
      });
    } catch (error) {
      if (!isPrismaMissingTable(error)) throw error;
      reply.header('csrf-token', req.csrfProtection.generateCsrf());
      return reply.status(503).send({
        status: 503,
        message: 'O banco das notificações ainda não foi atualizado. Peça ao administrador para concluir a migration com segurança.',
      });
    }
    if (devices.length === 0) {
      reply.header('csrf-token', req.csrfProtection.generateCsrf());
      return reply.status(409).send({
        status: 409,
        message: 'Nenhum aparelho está vinculado a esta conta. Abra o aplicativo gerado recentemente e aguarde o registro automático.',
      });
    }

    try {
      const results = await Promise.allSettled(
        devices.map(({ token }) => sendFirebaseNotification({ ...parsed.data, token }))
      );
      const sentCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = results.length - sentCount;
      reply.header('csrf-token', req.csrfProtection.generateCsrf());

      if (sentCount === 0) {
        req.log.warn({ userId: req.user.id, failedCount }, 'FCM delivery failed for all account devices');
        return reply.status(502).send({ status: 502, message: 'O Firebase não aceitou o envio para os aparelhos desta conta.' });
      }

      if (failedCount > 0) {
        req.log.warn({ userId: req.user.id, sentCount, failedCount }, 'FCM delivery partially failed for account devices');
      }
      return reply.send({
        status: 200,
        message: 'Notificação enviada somente aos aparelhos vinculados a esta conta.',
        sentCount,
        failedCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha inesperada ao enviar a notificação.';
      const configurationError =
        /Configure FIREBASE|credencial Firebase|conta de serviço Firebase|FIREBASE_PROJECT_ID/i.test(message);
      req.log.warn({ userId: req.user.id }, 'FCM notification send failed');
      reply.header('csrf-token', req.csrfProtection.generateCsrf());
      return reply.status(configurationError ? 503 : 502).send({
        status: configurationError ? 503 : 502,
        message,
      });
    }
  },
} as RouteOptions;
