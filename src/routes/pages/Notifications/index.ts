import { Render } from '../../../config/render-config';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import { isFirebaseConfigured } from '../../../services/firebase-messaging';
import prisma from '../../../config/prisma-client';

export default {
  url: '/notifications',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const devicesCount = await prisma.deviceFcmToken.count({ where: { user_id: req.user.id } });
    Render.page(req, reply, '/notifications/index.html', {
      user: req.user,
      active: 'notifications',
      csrfToken: req.csrfProtection.generateCsrf(),
      firebaseConfigured: isFirebaseConfigured(),
      devicesCount,
    });
  },
} as RouteOptions;
