import { Render } from '../../../config/render-config';
import formatDate from '../../../utils/format-date';
import Authentication from '../../../middlewares/authentication';
import { FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { getCollaboratorSettings } from '../../../utils/collaborator-settings';

export default {
  url: '/',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const collaboratorSettings = await getCollaboratorSettings(false);
    const daysRemaining = req.user.access_expires_at
      ? Math.max(0, Math.ceil((req.user.access_expires_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;
    Render.page(req, reply, '/home/index.html', {
      user: req.user,
      daysRemaining,
      formatDate,
      active: 'home',
      csrfToken: req.csrfProtection.generateCsrf(),
      collaboratorEnabled: collaboratorSettings.enabled && Boolean(collaboratorSettings.amountCents),
    });
  },
} as RouteOptions;
