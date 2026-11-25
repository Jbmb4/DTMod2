import { Render } from '../../../config/render-config';
import formatDate from '../../../utils/format-date';
import Authentication from '../../../middlewares/authentication';
import { FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { getCollaboratorSettings } from '../../../utils/collaborator-settings';
import { getAccessDaysRemaining } from '../../../utils/access-expiration';

export default {
  url: '/',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const collaboratorSettings = await getCollaboratorSettings(false);
    const daysRemaining = getAccessDaysRemaining(req.user.access_expires_at);
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
