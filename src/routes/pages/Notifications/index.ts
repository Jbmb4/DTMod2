import { Render } from '../../../config/render-config';
import AdminAuthentication from '../../../middlewares/admin-auth';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import { isFirebaseConfigured } from '../../../services/firebase-messaging';

export default {
  url: '/notifications',
  method: 'GET',
  onRequest: [AdminAuthentication.user],
  handler: (req: FastifyRequest, reply: FastifyReply) => {
    Render.page(req, reply, '/notifications/index.html', {
      user: req.user,
      active: 'notifications',
      csrfToken: req.csrfProtection.generateCsrf(),
      firebaseConfigured: isFirebaseConfigured(),
    });
  },
} as RouteOptions;
