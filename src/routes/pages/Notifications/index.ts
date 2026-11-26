import { Render } from '../../../config/render-config';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

export default {
  url: '/notifications',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    Render.page(req, reply, '/notifications/index.html', {
      user: req.user,
      active: 'notifications',
      csrfToken: req.csrfProtection.generateCsrf(),
    });
  },
} as RouteOptions;
