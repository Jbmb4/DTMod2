import { z } from 'zod';
import Authentication from '../../middlewares/authentication';
import csrfProtection from '../../middlewares/csrf-protection';
import prisma from '../../config/prisma-client';
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

    try {
      const notification = await prisma.inAppNotification.create({
        data: {
          user_id: req.user.id,
          title: parsed.data.title,
          message: parsed.data.message,
          image_url: parsed.data.imageUrl || null,
        },
        select: { id: true, created_at: true },
      });
      reply.header('csrf-token', req.csrfProtection.generateCsrf());
      return reply.send({
        status: 200,
        message: 'Mensagem salva para aparecer no aplicativo quando ele estiver aberto e conectado.',
        id: notification.id,
        createdAt: notification.created_at,
      });
    } catch (error) {
      if (!isPrismaMissingTable(error)) throw error;
      reply.header('csrf-token', req.csrfProtection.generateCsrf());
      return reply.status(503).send({
        status: 503,
        message:
          'A caixa de mensagens ainda não foi instalada no banco. Aplique a migration in_app_notifications antes de enviar.',
      });
    }
  },
} as RouteOptions;
