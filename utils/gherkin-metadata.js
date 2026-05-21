import fs from 'fs';
import { IdGenerator } from '@cucumber/messages';
import {
  Parser,
  AstBuilder,
  GherkinClassicTokenMatcher
} from '@cucumber/gherkin';

function parseFeatureFile(featureFilePath) {
  if (!featureFilePath || !fs.existsSync(featureFilePath)) {
    return null;
  }

  const content = fs.readFileSync(featureFilePath, 'utf-8');

  const builder = new AstBuilder(IdGenerator.uuid());
  const matcher = new GherkinClassicTokenMatcher();
  const parser = new Parser(builder, matcher);

  return parser.parse(content);
}

export function getFeatureMetadata(featureFilePath) {
  const document = parseFeatureFile(featureFilePath);

  if (!document?.feature) {
    return {
      name: null,
      language: null,
      uri: featureFilePath || null
    };
  }

  return {
    name: document.feature.name || null,
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