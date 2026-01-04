/**
 * OpenAPI Documentation Lambda Handler
 * Serves the pre-built OpenAPI specification YAML file
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read pre-built spec at module load time (Lambda container reuse)
const specPath = path.join(__dirname, '../../openapi.yml');
let cachedSpec: string | null = null;

try {
  cachedSpec = fs.readFileSync(specPath, 'utf-8');
} catch (error) {
  console.error('Failed to load OpenAPI spec:', error);
}

/**
 * Lambda handler for serving OpenAPI specification
 */
export async function handler(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.error('OpenAPI spec request received');

    if (!cachedSpec) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'OpenAPI specification not available',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/x-yaml',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
        // Help browsers download as file
        'Content-Disposition': 'inline; filename="openapi.yml"',
      },
      body: cachedSpec,
    };
  } catch (error) {
    console.error('Error serving OpenAPI spec:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to serve OpenAPI spec',
      }),
    };
  }
}
