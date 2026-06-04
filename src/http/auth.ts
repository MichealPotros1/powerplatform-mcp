import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

function isTruthy(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export interface AuthOptions {
  required: boolean;
}

export function loadAuthOptionsFromEnv(): AuthOptions {
  return {
    required: isTruthy(process.env.API_AUTH_REQUIRED, true),
  };
}

export function createAuthMiddleware(options: AuthOptions) {
  if (!options.required) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const tenantId = process.env.API_AUTH_TENANT_ID;
  const audience = process.env.API_AUTH_AUDIENCE;

  if (!tenantId || !audience) {
    throw new Error('API auth is enabled but API_AUTH_TENANT_ID or API_AUTH_AUDIENCE is missing.');
  }

  const issuer = process.env.API_AUTH_ISSUER ?? `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const jwks = createRemoteJWKSet(
    new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`),
  );

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
      }

      const token = authHeader.slice('Bearer '.length);
      await jwtVerify(token, jwks, {
        issuer,
        audience,
      });

      next();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Token validation failed';
      res.status(401).json({ error: `Unauthorized: ${message}` });
    }
  };
}
