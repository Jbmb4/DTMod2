import { z } from 'zod';
import AdminAuthentication from '../../middlewares/admin-auth';
import csrfProtection from '../../utils/csrf-protection';
import { sendFirebaseNotification } from '../../services/firebase-messaging';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

const notificationSchema = z.object({
  token: z.string().trim().min(10).max(4096),
  title: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(2000),
  imageUrl: z.string().trim().max(2048).optional().default(''),
});

export default {
  url: '/notifications/send',
  method: 'POST',
  onRequest: [csrfProtection, AdminAuthentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = notificationSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.header('csrf-token', req.csrfProtection.generateCsrf());
      return reply.status(400).send({
        status: 400,
        message: 'Confira o token FCM, o título, a mensagem e a URL da imagem.',
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

    try {
      const messageId = await sendFirebaseNotification(parsed.data);
      reply.header('csrf-token', req.csrfProtection.generateCsrf());
      return reply.send({ status: 200, message: 'Notificação enviada ao Firebase Cloud Messaging.', messageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha inesperada ao enviar a notificação.';
      const configurationError =
        /Configure FIREBASE|credencial Firebase|conta de serviço Firebase|FIREBASE_PROJECT_ID/i.test(message);
      req.log.warn({ err: error }, 'FCM notification send failed');
      reply.header('csrf-token', req.csrfProtection.generateCsrf());
      return reply.status(configurationError ? 503 : 502).send({
        status: configurationError ? 503 : 502,
        message,
      });
    }
  },
} as RouteOptions;
