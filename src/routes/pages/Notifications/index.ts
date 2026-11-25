import { Render } from '../../../config/render-config';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import { isFirebaseConfigured } from '../../../services/firebase-messaging';
import prisma from '../../../config/prisma-client';
import isPrismaMissingTable from '../../../utils/is-prisma-missing-table';

export default {
  url: '/notifications',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    let devicesCount = 0;
    let deviceStoreReady = true;
    try {
      devicesCount = await prisma.deviceFcmToken.count({ where: { user_id: req.user.id } });
    } catch (error) {
      if (!isPrismaMissingTable(error)) throw error;
      deviceStoreReady = false;
      req.log.warn({ userId: req.user.id }, 'FCM tables are missing; notification migration is pending');
    }
    Render.page(req, reply, '/notifications/index.html', {
      user: req.user,
      active: 'notifications',
      csrfToken: req.csrfProtection.generateCsrf(),
      firebaseConfigured: isFirebaseConfigured(),
      devicesCount,
      deviceStoreReady,
    });
  },
} as RouteOptions;
