import fs from 'fs';
import path from 'path';
import { IdGenerator } from '@cucumber/messages';
import {
  Parser,
  AstBuilder,
  GherkinClassicTokenMatcher
} from '@cucumber/gherkin';

//
// Cache parsed feature files to avoid re-parsing per scenario
//
const parseCache = new Map();

function parseFeatureFile(featureFilePath) {
  // If it's a file:// URI, parse it correctly or strip it
  let resolvedPath = featureFilePath;
  if (resolvedPath && resolvedPath.startsWith('file://')) {
    resolvedPath = resolvedPath.replace('file://', '');
  }

  // Handle absolute path resolution
  if (resolvedPath && !path.isAbsolute(resolvedPath)) {
    resolvedPath = path.resolve(process.cwd(), resolvedPath);
  }

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    console.warn(`[Gherkin Cache] File not found or empty path: "${featureFilePath}" (Resolved: "${resolvedPath}")`);
    return null;
  }

  if (parseCache.has(resolvedPath)) {
    return parseCache.get(resolvedPath);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');

  const builder = new AstBuilder(IdGenerator.uuid());
  const matcher = new GherkinClassicTokenMatcher();
  const parser = new Parser(builder, matcher);

  const result = parser.parse(content);

  parseCache.set(featureFilePath, result);

  return result;
}

export function getFeatureMetadata(featureFilePath) {
  const document = parseFeatureFile(featureFilePath);

  if (!document?.feature) {
    return {
      name: null,
      description: null,
      language: null,
      uri: featureFilePath || null
    };
  }

  return {
    name: document.feature.name || null,
    description: document.feature.description ? document.feature.description.trim() : null,
    language: document.feature.language || null,
    uri: featureFilePath || null
  };
}

export function getBackgroundMetadata(featureFilePath) {
  const document = parseFeatureFile(featureFilePath);

  const background = document?.feature?.children?.find(
    (child) => child.background
  )?.background;

  if (!background) {
    return {
      name: null,
      steps: []
    };
  }

  return {
    name: background.name || null,
    steps: background.steps.map((step) => ({
      keyword: step.keyword,
      text: step.text,
      keywordType: step.keywordType
    }))
  };
}

export function getScenarioStepsFromWorld(world) {
  return (
    world?.pickle?.steps?.map((step) => ({
      text: step.text,
      type: step.type
    })) || []
  );
}

export function getScenarioTagsFromWorld(world) {
  return world?.pickle?.tags?.map((tag) => tag.name) || [];
}