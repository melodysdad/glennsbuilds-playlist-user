/**
 * Build-time OpenAPI Spec Generator
 * Generates openapi.yml from Zod schemas and writes to build directory
 */

import { generateOpenApiDocument } from '../src/openapi/registry.js';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log('Generating OpenAPI specification...');

  // Generate the OpenAPI document
  const spec = generateOpenApiDocument();

  // Convert to YAML
  const yamlSpec = yaml.dump(spec, {
    lineWidth: -1, // No line wrapping
    noRefs: false, // Allow $ref usage
    sortKeys: false, // Preserve key order
  });

  // Ensure build directory exists
  const buildDir = path.join(__dirname, '../build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // Write to build/openapi.yml
  const outputPath = path.join(buildDir, 'openapi.yml');
  fs.writeFileSync(outputPath, yamlSpec, 'utf-8');

  console.log(`✓ OpenAPI spec written to ${outputPath}`);
  console.log(`✓ Spec includes ${Object.keys(spec.paths || {}).length} endpoints`);
  console.log(`✓ Spec version: ${spec.openapi}`);
} catch (error) {
  console.error('Error generating OpenAPI spec:', error);
  process.exit(1);
}
