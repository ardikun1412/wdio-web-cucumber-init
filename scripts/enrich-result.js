import fs from 'fs';
import path from 'path';

/* ================= PATH ================= */

const allureDir = path.join(process.cwd(), 'allure-results');
const outputDir = path.join(allureDir, 'enriched-results');
const metadataDir = path.join(allureDir, '.metadata');

/* ================= FILE FILTER ================= */

function cleanOutputDir() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    return;
  }

  for (const file of fs.readdirSync(outputDir)) {
    const filePath = path.join(outputDir, file);

    if (fs.lstatSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
    }
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getLatestResultFiles(resultFiles) {
  const latestByScenario = {};

  for (const resultFile of resultFiles) {
    const resultPath = path.join(allureDir, resultFile);
    const result = readJson(resultPath);

    if (!result.name) continue;

    const existing = latestByScenario[result.name];

    if (!existing || (result.start || 0) > (existing.result.start || 0)) {
      latestByScenario[result.name] = {
        resultFile,
        resultPath,
        result
      };
    }
  }

  return Object.values(latestByScenario);
}

/* ================= UTIL ================= */

function sanitizeFileName(name, fallback = 'attachment') {
  return String(name || fallback)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 150);
}

function normalizeStepName(name) {
  return String(name || '')
    .replace(/^(Given|When|Then|And|But|Before|After)\s+/i, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isImageAttachment(attachment) {
  return (
    attachment &&
    attachment.source &&
    (
      attachment.type?.startsWith('image/') ||
      attachment.source.endsWith('.png') ||
      attachment.source.endsWith('.jpg') ||
      attachment.source.endsWith('.jpeg')
    )
  );
}

function buildAttachmentPath(attachment) {
  const absolutePath = path.join(allureDir, attachment.source);

  return {
    name: attachment.name || 'Attachment',
    type: attachment.type || null,
    source: attachment.source,
    relativePathFromEnriched: path.relative(outputDir, absolutePath),
    absolutePath,
    exists: fs.existsSync(absolutePath)
  };
}

function readExecutionMetadataByScenarioName(scenarioName) {
  if (!fs.existsSync(metadataDir)) {
    return {
      source: null,
      data: null
    };
  }

  const safeScenarioName = sanitizeFileName(scenarioName, 'scenario');

  const metadataPath = path.join(
    metadataDir,
    `execution_metadata_${safeScenarioName}.json`
  );

  if (!fs.existsSync(metadataPath)) {
    return {
      source: null,
      data: null
    };
  }

  return {
    source: metadataPath,
    data: readJson(metadataPath)
  };
}

function cleanMetadataDir() {
  if (fs.existsSync(metadataDir)) {
    fs.rmSync(metadataDir, {
      recursive: true,
      force: true
    });
  }
}

/* ================= STEP FILTER ================= */

function getBackgroundStepSet(backgroundSteps = []) {
  return new Set(
    backgroundSteps.map((step) =>
      normalizeStepName(step.text || step.name)
    )
  );
}

function removeBackgroundStepsFromResultSteps(resultSteps = [], backgroundSteps = []) {
  const backgroundStepSet = getBackgroundStepSet(backgroundSteps);

  return resultSteps.filter((step) => {
    const stepName = normalizeStepName(step.name);
    return !backgroundStepSet.has(stepName);
  });
}

function removeBackgroundStepsFromScenarioSteps(scenarioSteps = [], backgroundSteps = []) {
  const backgroundStepSet = getBackgroundStepSet(backgroundSteps);

  return scenarioSteps.filter((step) => {
    const stepText = normalizeStepName(step.text || step.name);
    return !backgroundStepSet.has(stepText);
  });
}

/* ================= ATTACHMENTS ================= */

function collectAttachmentsFromSteps(steps = []) {
  const attachments = [];

  for (const step of steps) {
    for (const attachment of step.attachments || []) {
      attachments.push({
        stepName: step.name || null,
        attachment
      });
    }

    const nested = collectAttachmentsFromSteps(step.steps || []);

    for (const item of nested) {
      attachments.push(item);
    }
  }

  return attachments;
}

function collectResultStepAttachments(resultSteps = []) {
  const rawAttachments = collectAttachmentsFromSteps(resultSteps);

  return rawAttachments.map((item) => ({
    stepName: item.stepName,
    ...buildAttachmentPath(item.attachment)
  }));
}

function collectContainerAttachments(container) {
  const attachments = [];

  for (const before of container.befores || []) {
    for (const attachment of before.attachments || []) {
      attachments.push({
        hook: 'before',
        stepName: null,
        attachment
      });
    }

    const nested = collectAttachmentsFromSteps(before.steps || []);

    for (const item of nested) {
      attachments.push({
        hook: 'before',
        stepName: item.stepName,
        attachment: item.attachment
      });
    }
  }

  for (const after of container.afters || []) {
    for (const attachment of after.attachments || []) {
      attachments.push({
        hook: 'after',
        stepName: null,
        attachment
      });
    }

    const nested = collectAttachmentsFromSteps(after.steps || []);

    for (const item of nested) {
      attachments.push({
        hook: 'after',
        stepName: item.stepName,
        attachment: item.attachment
      });
    }
  }

  return attachments.map((item) => ({
    hook: item.hook,
    stepName: item.stepName,
    ...buildAttachmentPath(item.attachment)
  }));
}

/* ================= ENRICH ================= */

export function enrichAllureResults() {
  if (!fs.existsSync(allureDir)) {
    throw new Error(`Allure results folder not found: ${allureDir}`);
  }

  cleanOutputDir();

  const files = fs.readdirSync(allureDir);

  const resultFiles = files.filter((file) => file.endsWith('-result.json'));
  const latestResults = getLatestResultFiles(resultFiles);
  const containerFiles = files.filter((file) => file.endsWith('-container.json'));

  const containers = containerFiles.map((file) => ({
    file,
    data: readJson(path.join(allureDir, file))
  }));

  const enrichedFiles = [];

  for (const item of latestResults) {
    const { resultFile, resultPath, result } = item;

    const relatedContainers = containers.filter((container) =>
      (container.data.children || []).includes(result.uuid)
    );

    const containerAttachments = relatedContainers.flatMap((container) =>
      collectContainerAttachments(container.data)
    );

    const customMetadata = readExecutionMetadataByScenarioName(result.name);

    const backgroundSteps = customMetadata.data?.background?.steps || [];

    const filteredResultSteps = removeBackgroundStepsFromResultSteps(
      result.steps || [],
      backgroundSteps
    );

    const filteredScenarioSteps = removeBackgroundStepsFromScenarioSteps(
      customMetadata.data?.scenario?.steps || [],
      backgroundSteps
    );

    const resultAttachments = collectResultStepAttachments(filteredResultSteps);

    const screenshots = resultAttachments.filter(isImageAttachment);

    const scenario = customMetadata.data?.scenario
      ? {
          ...customMetadata.data.scenario,
          steps: filteredScenarioSteps
        }
      : null;

    const enriched = {
      uuid: result.uuid,
      name: result.name,
      status: result.status,
      statusDetails: result.statusDetails || {},
      start: result.start,
      stop: result.stop,
      durationMs:
        typeof result.start === 'number' && typeof result.stop === 'number'
          ? result.stop - result.start
          : null,

      feature: customMetadata.data?.feature || null,
      background: customMetadata.data?.background || null,
      scenario,
      executionResult: customMetadata.data?.result || null,
      environment: customMetadata.data?.environment || null,
      timestamp: customMetadata.data?.timestamp || null,

      steps: filteredResultSteps,

      evidence: {
        screenshots,
        resultAttachments: resultAttachments.filter(
          (attachment) => attachment.type !== 'application/json'
        ),
        containerAttachments: containerAttachments.filter(
          (attachment) => attachment.type !== 'application/json'
        )
      },

      allureMapping: {
        resultFile,
        resultPath,
        resultUuid: result.uuid,
        relatedContainers: relatedContainers.map((container) => container.file),
        outputDir
      }
    };

    const outputFile = resultFile.replace(
      '-result.json',
      '-enriched-result.json'
    );

    const outputPath = path.join(outputDir, outputFile);

    fs.writeFileSync(
      outputPath,
      JSON.stringify(enriched, null, 2),
      'utf8'
    );

    enrichedFiles.push(outputPath);

    console.log(`Created enriched result: ${outputPath}`);
  }

  console.log(`Done. Total enriched results: ${enrichedFiles.length}`);

  cleanMetadataDir();

  return enrichedFiles;
}

/* ================= CLI ================= */

enrichAllureResults();