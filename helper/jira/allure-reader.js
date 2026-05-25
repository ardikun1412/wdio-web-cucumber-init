/**
 * Allure Enriched Results Reader
 *
 * Reads enriched Allure result files and maps them to
 * a format suitable for Xray upload.
 */

import fs from 'fs';
import path from 'path';

const enrichedResultsPath = path.join(
  process.cwd(),
  'allure-results',
  'enriched-results'
);

function mapAllureStatusToXray(status) {
  switch (status) {
    case 'passed':
      return 'PASS';

    case 'failed':
    case 'broken':
      return 'FAIL';

    case 'skipped':
      return 'TODO';

    default:
      return 'TODO';
  }
}

async function extractAllureData() {
  if (!fs.existsSync(enrichedResultsPath)) {
    console.warn(`Enriched results folder not found: ${enrichedResultsPath}`);
    return [];
  }

  const files = fs.readdirSync(enrichedResultsPath)
    .filter(file => file.endsWith('-enriched-result.json'))
    .map(file => {
      const filePath = path.join(enrichedResultsPath, file);

      return {
        file,
        filePath,
        mtimeMs: fs.statSync(filePath).mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const results = [];

  for (const item of files) {
    let json;

    try {
      json = JSON.parse(fs.readFileSync(item.filePath, 'utf8'));
    } catch (err) {
      console.warn(`Failed to parse enriched result file: ${item.filePath}`);
      continue;
    }

    if (!json.name || !Array.isArray(json.steps)) continue;

    const screenshots = (json.evidence?.screenshots || [])
      .filter(shot => shot.exists && shot.absolutePath)
      .map((shot, index) => ({
        name:
          `step_${index + 1}_evidence` +
          `${path.extname(shot.source) || '.png'}`,

        path: shot.absolutePath,
        contentType: shot.type || 'image/png'
      }));

    const scenarioLines = (json.steps || [])
      .map(step => step.name)
      .filter(Boolean);

    results.push({
      name: json.name,

      featureName:
        json.feature?.name || 'Uncategorized Feature',

      featureDescription:
        json.feature?.description || null,

      // xrayRepository:
      //   `/${json.feature?.name || 'Uncategorized Feature'}`,

      background:
        json.background || null,

      status:
        mapAllureStatusToXray(json.status),

      scenarioText: [
        `Scenario: ${json.name}`,
        ...scenarioLines
      ].join('\n'),

      screenshots,

      enrichedFile: item.file,
      enrichedFilePath: item.filePath,
      enrichedMtimeMs: item.mtimeMs,
      start: json.start || 0,
      stop: json.stop || null,
      timestamp: json.timestamp || null
    });
  }

  return Object.values(
    results.reduce((acc, item) => {
      const existing = acc[item.name];

      const currentTime = item.start || Date.parse(item.timestamp || 0);
      const existingTime = existing
        ? existing.start || Date.parse(existing.timestamp || 0)
        : 0;

      if (!existing || currentTime > existingTime) {
        acc[item.name] = item;
      }

      return acc;
    }, {})
  );
}

export { extractAllureData, mapAllureStatusToXray };
