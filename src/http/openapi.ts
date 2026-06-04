export function buildOpenApiDocument(baseUrl?: string): Record<string, unknown> {
  const tenantId = process.env.API_AUTH_TENANT_ID ?? 'common';
  const audience = process.env.API_AUTH_AUDIENCE ?? 'api://replace-with-app-id-uri';

  return {
    openapi: '3.0.3',
    info: {
      title: 'PowerPlatform HTTP API',
      version: '1.0.0',
      description:
        'HTTP facade over powerplatform-mcp services for use in Copilot Studio Custom Connectors.',
    },
    servers: baseUrl ? [{ url: baseUrl }] : [],
    components: {
      securitySchemes: {
        entraOAuth: {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
              tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
              scopes: {
                [audience + '/.default']: 'Access PowerPlatform HTTP API',
              },
            },
          },
        },
      },
      schemas: {
        QueryRecordsRequest: {
          type: 'object',
          required: ['entityNamePlural', 'filter'],
          properties: {
            environment: { type: 'string' },
            entityNamePlural: { type: 'string' },
            filter: { type: 'string' },
            maxRecords: { type: 'integer', minimum: 1, default: 50 },
          },
        },
        CreateRecordRequest: {
          type: 'object',
          required: ['data'],
          properties: {
            environment: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        UpdateRecordRequest: {
          type: 'object',
          required: ['data'],
          properties: {
            environment: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        ExportSolutionRequest: {
          type: 'object',
          required: ['solutionName'],
          properties: {
            environment: { type: 'string' },
            solutionName: { type: 'string' },
            managed: { type: 'boolean', default: false },
          },
        },
      },
    },
    security: [{ entraOAuth: [audience + '/.default'] }],
    paths: {
      '/health': {
        get: {
          operationId: 'health',
          security: [],
          responses: {
            '200': { description: 'API health status' },
          },
        },
      },
      '/openapi.json': {
        get: {
          operationId: 'openApi',
          security: [],
          responses: {
            '200': { description: 'OpenAPI document' },
          },
        },
      },
      '/v1/entities/{entityName}/metadata': {
        get: {
          operationId: 'getEntityMetadata',
          parameters: [
            { name: 'entityName', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'environment', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Entity metadata' } },
        },
      },
      '/v1/entities/{entityName}/attributes': {
        get: {
          operationId: 'getEntityAttributes',
          parameters: [
            { name: 'entityName', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'environment', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Entity attributes' } },
        },
      },
      '/v1/entities/{entityName}/attributes/{attributeName}': {
        get: {
          operationId: 'getEntityAttribute',
          parameters: [
            { name: 'entityName', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'attributeName', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'environment', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Entity attribute metadata' } },
        },
      },
      '/v1/entities/{entityName}/relationships': {
        get: {
          operationId: 'getEntityRelationships',
          parameters: [
            { name: 'entityName', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'environment', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Entity relationships' } },
        },
      },
      '/v1/records/query': {
        post: {
          operationId: 'queryRecords',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/QueryRecordsRequest' },
              },
            },
          },
          responses: { '200': { description: 'Record query results' } },
        },
      },
      '/v1/records/{entityNamePlural}/{recordId}': {
        get: {
          operationId: 'getRecord',
          parameters: [
            { name: 'entityNamePlural', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'recordId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'environment', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Record payload' } },
        },
        patch: {
          operationId: 'updateRecord',
          parameters: [
            { name: 'entityNamePlural', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'recordId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateRecordRequest' },
              },
            },
          },
          responses: { '204': { description: 'Record updated' } },
        },
        delete: {
          operationId: 'deleteRecord',
          parameters: [
            { name: 'entityNamePlural', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'recordId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'environment', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '204': { description: 'Record deleted' } },
        },
      },
      '/v1/records/{entityNamePlural}': {
        post: {
          operationId: 'createRecord',
          parameters: [
            { name: 'entityNamePlural', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateRecordRequest' },
              },
            },
          },
          responses: { '200': { description: 'Created record id' } },
        },
      },
      '/v1/solutions': {
        get: {
          operationId: 'getSolutions',
          parameters: [{ name: 'environment', in: 'query', required: false, schema: { type: 'string' } }],
          responses: { '200': { description: 'Visible solutions' } },
        },
      },
      '/v1/solutions/{uniqueName}': {
        get: {
          operationId: 'getSolution',
          parameters: [
            { name: 'uniqueName', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'environment', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Solution details' } },
        },
      },
      '/v1/solutions/{uniqueName}/components': {
        get: {
          operationId: 'getSolutionComponents',
          parameters: [
            { name: 'uniqueName', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'environment', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Solution component list' } },
        },
      },
      '/v1/solutions/export': {
        post: {
          operationId: 'exportSolution',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ExportSolutionRequest' },
              },
            },
          },
          responses: { '200': { description: 'Base64 solution package' } },
        },
      },
    },
  };
}
