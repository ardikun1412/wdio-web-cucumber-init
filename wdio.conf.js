import dotenv from 'dotenv';
import allureReporter from '@wdio/allure-reporter';
import { envConfig } from './config/env.config.js';

import {
  getFeatureMetadata,
  getBackgroundMetadata,
  getScenarioStepsFromWorld,
  getScenarioTagsFromWorld
} from './utils/gherkin-metadata.js';

import { saveExecutionMetadata } from './utils/execution-metadata.js';

dotenv.config();

const testEnv = process.env.TEST_ENV || 'dev';
const browserName = process.env.BROWSER || 'chrome';
const isDocker = process.env.DOCKER === 'true';

export const config = {
  runner: 'local',

  specs: ['./test/features/**/*.feature'],

  maxInstances: 1,

  capabilities: [
    {
      browserName,
      'goog:chromeOptions': {
        args: [
          '--disable-gpu',
          '--window-size=1920,1080',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          ...(process.env.HEADLESS === 'true' ? ['--headless=new'] : [])
        ]
      }
    }
  ],

  logLevel: process.env.LOG_LEVEL || 'info',

  bail: 0,

  baseUrl: envConfig.baseUrl,

  waitforTimeout: Number(process.env.WAIT_FOR_TIMEOUT || 10000),

  connectionRetryTimeout: 120000,

  connectionRetryCount: 3,

  services: [],

  ...(isDocker
    ? {
        hostname: process.env.SELENIUM_HOST || 'selenium',
        port: Number(process.env.SELENIUM_PORT || 4444),
        path: '/wd/hub'
      }
    : {}),

  framework: 'cucumber',

  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: true,

        // Penting:
        // false supaya browser.takeScreenshot() masuk ke Allure.
        disableWebdriverScreenshotsReporting: false,

        useCucumberStepReporter: true,

        disableMochaHooks: false,

        reportedEnvironmentVars: {
          Environment: testEnv,
          Base_URL: envConfig.baseUrl,
          Browser: browserName,
          Headless: process.env.HEADLESS || 'false',
          Node_Version: process.version
        }
      }
    ]
  ],

  cucumberOpts: {
    require: ['./test/step-definitions/**/*.steps.js'],
    backtrace: false,
    requireModule: [],
    dryRun: false,
    failFast: false,
    snippets: true,
    source: true,
    strict: false,
    tagExpression: process.env.TAGS || '',
    timeout: Number(process.env.STEP_TIMEOUT || 60000),
    ignoreUndefinedDefinitions: false
  },

  before: async function () {
    await browser.maximizeWindow();
  },

  beforeScenario: async function (world) {
  const scenarioName = world?.pickle?.name || 'Unnamed Scenario';
  const featureFilePath = world?.pickle?.uri || world?.gherkinDocument?.uri;

  const feature = getFeatureMetadata(featureFilePath);
  const background = getBackgroundMetadata(featureFilePath);
  const tags = getScenarioTagsFromWorld(world);

  allureReporter.addLabel('environment', testEnv);
  allureReporter.addLabel('browser', browserName);
  allureReporter.addLabel('baseUrl', envConfig.baseUrl);
  allureReporter.addStory(scenarioName);

  if (feature?.name) {
    allureReporter.addFeature(feature.name);
  }

  if (background?.name) {
    // Cukup label saja.
    // Jangan addAttachment di beforeScenario agar tidak muncul di Test body.
    allureReporter.addLabel('background', background.name);
  }

  for (const tag of tags) {
    allureReporter.addTag(tag);
  }
},

afterStep: async function () {
  await browser.takeScreenshot();
},

afterScenario: async function (world, result) {
  const rawScenarioName = world?.pickle?.name || 'Unnamed Scenario';
  const featureFilePath = world?.pickle?.uri || world?.gherkinDocument?.uri;

  const feature = getFeatureMetadata(featureFilePath);
  const background = getBackgroundMetadata(featureFilePath);
  const scenarioSteps = getScenarioStepsFromWorld(world);
  const tags = getScenarioTagsFromWorld(world);

  const scenarioData = {
    feature,

    background,

    scenario: {
      name: rawScenarioName,
      tags,
      steps: scenarioSteps
    },

    result: {
      status: result?.passed ? 'PASSED' : 'FAILED',
      duration: result?.duration || null
    },

    environment: {
      name: testEnv,
      baseUrl: envConfig.baseUrl,
      browser: browserName,
      headless: process.env.HEADLESS || 'false',
      nodeVersion: process.version
    },

    timestamp: new Date().toISOString()
  };

  saveExecutionMetadata(scenarioData);

  if (!result?.passed) {
    await browser.takeScreenshot();
  }
}

};