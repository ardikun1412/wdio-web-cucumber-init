import fs from 'fs';
import path from 'path';
import { sanitizeFileName } from './sanitize.js';

const metadataDir = path.join(process.cwd(), 'allure-results', '.metadata');

export function saveExecutionMetadata(metadata) {
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  const scenarioName = sanitizeFileName(
    metadata?.scenario?.name || 'scenario',
    'scenario'
  );

  const metadataPath = path.join(
    metadataDir,
    `execution_metadata_${scenarioName}.json`
  );

  fs.writeFileSync(
    metadataPath,
    JSON.stringify(metadata, null, 2),
    'utf8'
  );

  return metadataPath;
}