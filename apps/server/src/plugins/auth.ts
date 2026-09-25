import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { AuthUser } from '@github-bot/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  // Authentication preHandler hook
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionCookie = request.cookies.session;

    if (!sessionCookie) {
      return reply.status(401).send({
        authenticated: false,
        error: 'Authentication required. No session cookie provided.',
      });
    }

    const unsigned = request.unsignCookie(sessionCookie);

    if (!unsigned.valid || !unsigned.value) {
      return reply.status(401).send({
        authenticated: false,
        error: 'Invalid or expired session cookie.',
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: unsigned.value },
        select: {
          id: true,
          githubId: true,
          githubUsername: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(401).send({
          authenticated: false,
          error: 'User account not found.',
        });
      }

      request.user = user;
    } catch (err) {
      fastify.log.error({ err }, 'Error looking up session user');
      return reply.status(500).send({
        authenticated: false,
        error: 'Internal server error verifying session.',
      });
    }
  });
});
