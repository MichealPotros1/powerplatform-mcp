#!/usr/bin/env node
import express, { type NextFunction, type Request, type Response } from 'express';
import { EnvironmentRegistry } from './environment-config.js';
import { createAuthMiddleware, loadAuthOptionsFromEnv } from './http/auth.js';
import { buildOpenApiDocument } from './http/openapi.js';

interface EnvBody {
  environment?: string;
}

function getRouteParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  throw new Error(`Missing route parameter: ${key}`);
}

function getRequestedEnvironment(req: Request): string | undefined {
  const queryEnv = typeof req.query.environment === 'string' ? req.query.environment : undefined;
  const bodyEnv = (req.body as EnvBody | undefined)?.environment;
  const headerEnv = typeof req.headers['x-powerplatform-environment'] === 'string'
    ? req.headers['x-powerplatform-environment']
    : undefined;

  return queryEnv ?? bodyEnv ?? headerEnv;
}

function createApp(): express.Express {
  const app = express();
  const registry = new EnvironmentRegistry();

  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      environments: registry.getEnvironmentNames(),
      defaultEnvironment: registry.getDefaultEnvironment(),
      authRequired: loadAuthOptionsFromEnv().required,
    });
  });

  app.get('/openapi.json', (req, res) => {
    const explicitBaseUrl = process.env.API_BASE_URL;
    const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
    const doc = buildOpenApiDocument(explicitBaseUrl ?? requestBaseUrl);
    res.json(doc);
  });

  app.use(createAuthMiddleware(loadAuthOptionsFromEnv()));

  const asyncRoute = (
    handler: (req: Request, res: Response) => Promise<void>,
  ) => (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

  app.get('/v1/entities/:entityName/metadata', asyncRoute(async (req, res) => {
    const ctx = registry.getContext(getRequestedEnvironment(req));
    const entityName = getRouteParam(req, 'entityName');
    const result = await ctx.getEntityService().getEntityMetadata(entityName);
    res.json(result);
  }));

  app.get('/v1/entities/:entityName/attributes', asyncRoute(async (req, res) => {
    const ctx = registry.getContext(getRequestedEnvironment(req));
    const entityName = getRouteParam(req, 'entityName');
    const result = await ctx.getEntityService().getEntityAttributes(entityName);
    res.json(result);
  }));

  app.get('/v1/entities/:entityName/attributes/:attributeName', asyncRoute(async (req, res) => {
    const ctx = registry.getContext(getRequestedEnvironment(req));
    const entityName = getRouteParam(req, 'entityName');
    const attributeName = getRouteParam(req, 'attributeName');
    const result = await ctx
      .getEntityService()
      .getEntityAttribute(entityName, attributeName);
    res.json(result);
  }));

  app.get('/v1/entities/:entityName/relationships', asyncRoute(async (req, res) => {
    const ctx = registry.getContext(getRequestedEnvironment(req));
    const entityName = getRouteParam(req, 'entityName');
    const result = await ctx.getEntityService().getEntityRelationships(entityName);
    res.json(result);
  }));

  app.post('/v1/records/query', asyncRoute(async (req, res) => {
    const body = req.body as {
      environment?: string;
      entityNamePlural?: string;
      filter?: string;
      maxRecords?: number;
    };

    if (!body.entityNamePlural || !body.filter) {
      res.status(400).json({ error: 'entityNamePlural and filter are required' });
      return;
    }

    const ctx = registry.getContext(body.environment ?? getRequestedEnvironment(req));
    const result = await ctx
      .getRecordService()
      .queryRecords(body.entityNamePlural, body.filter, body.maxRecords ?? 50);
    res.json(result);
  }));

  app.get('/v1/records/:entityNamePlural/:recordId', asyncRoute(async (req, res) => {
    const ctx = registry.getContext(getRequestedEnvironment(req));
    const entityNamePlural = getRouteParam(req, 'entityNamePlural');
    const recordId = getRouteParam(req, 'recordId');
    const result = await ctx
      .getRecordService()
      .getRecord(entityNamePlural, recordId);
    res.json(result);
  }));

  app.post('/v1/records/:entityNamePlural', asyncRoute(async (req, res) => {
    const body = req.body as {
      environment?: string;
      data?: Record<string, unknown>;
    };

    if (!body.data || typeof body.data !== 'object') {
      res.status(400).json({ error: 'data object is required' });
      return;
    }

    const ctx = registry.getContext(body.environment ?? getRequestedEnvironment(req));
    const entityNamePlural = getRouteParam(req, 'entityNamePlural');
    const result = await ctx.getRecordService().createRecord(entityNamePlural, body.data);
    res.json(result);
  }));

  app.patch('/v1/records/:entityNamePlural/:recordId', asyncRoute(async (req, res) => {
    const body = req.body as {
      environment?: string;
      data?: Record<string, unknown>;
    };

    if (!body.data || typeof body.data !== 'object') {
      res.status(400).json({ error: 'data object is required' });
      return;
    }

    const ctx = registry.getContext(body.environment ?? getRequestedEnvironment(req));
    const entityNamePlural = getRouteParam(req, 'entityNamePlural');
    const recordId = getRouteParam(req, 'recordId');
    await ctx
      .getRecordService()
      .updateRecord(entityNamePlural, recordId, body.data);

    res.status(204).send();
  }));

  app.delete('/v1/records/:entityNamePlural/:recordId', asyncRoute(async (req, res) => {
    const ctx = registry.getContext(getRequestedEnvironment(req));
    const entityNamePlural = getRouteParam(req, 'entityNamePlural');
    const recordId = getRouteParam(req, 'recordId');
    await ctx
      .getRecordService()
      .deleteRecord(entityNamePlural, recordId);
    res.status(204).send();
  }));

  app.get('/v1/solutions', asyncRoute(async (req, res) => {
    const ctx = registry.getContext(getRequestedEnvironment(req));
    const result = await ctx.getSolutionService().getSolutions();
    res.json(result);
  }));

  app.get('/v1/solutions/:uniqueName', asyncRoute(async (req, res) => {
    const ctx = registry.getContext(getRequestedEnvironment(req));
    const uniqueName = getRouteParam(req, 'uniqueName');
    const result = await ctx.getSolutionService().getSolution(uniqueName);
    if (!result) {
      res.status(404).json({ error: `Solution '${uniqueName}' not found` });
      return;
    }
    res.json(result);
  }));

  app.get('/v1/solutions/:uniqueName/components', asyncRoute(async (req, res) => {
    const ctx = registry.getContext(getRequestedEnvironment(req));
    const uniqueName = getRouteParam(req, 'uniqueName');
    const result = await ctx.getSolutionService().getSolutionComponents(uniqueName);
    res.json(result);
  }));

  app.post('/v1/solutions/export', asyncRoute(async (req, res) => {
    const body = req.body as {
      environment?: string;
      solutionName?: string;
      managed?: boolean;
    };

    if (!body.solutionName) {
      res.status(400).json({ error: 'solutionName is required' });
      return;
    }

    const ctx = registry.getContext(body.environment ?? getRequestedEnvironment(req));
    const result = await ctx.getSolutionService().exportSolution(body.solutionName, body.managed ?? false);
    res.json(result);
  }));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    res.status(500).json({ error: message });
  });

  return app;
}

async function main(): Promise<void> {
  const app = createApp();
  const port = Number(process.env.PORT ?? 8080);

  app.listen(port, () => {
    console.error(`PowerPlatform HTTP API listening on port ${port}`);
  });
}

main().catch((error) => {
  console.error('Fatal error in http server:', error);
  process.exit(1);
});
