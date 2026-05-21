import fs from 'fs';
import path from 'path';

const outputDir = 'custom-results';
const outputFile = path.join(outputDir, 'background-summary.json');

export function writeBackgroundSummaryJson(payload) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let existingData = [];

  if (fs.existsSync(outputFile)) {
    const rawData = fs.readFileSync(outputFile, 'utf-8');

    if (rawData.trim()) {
      existingData = JSON.parse(rawData);
    }
  }

  existingData.push({
    timestamp: new Date().toISOString(),
    ...payload
  });

  fs.writeFileSync(outputFile, JSON.stringify(existingData, null, 2));
}