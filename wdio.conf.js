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

//
// Environment
//
const testEnv = process.env.TEST_ENV || 'dev';

//
// Browser
// chrome | firefox
//
const browserName = process.env.BROWSER || 'chrome';

//
// Selenium Grid toggle
//
// true  = Selenium Grid
// false = local native browser
//
const useGrid = process.env.USE_GRID === 'true';

//
// Headless toggle
//
const isHeadless = process.env.HEADLESS === 'true';

//
// Max parallel instances
//
const maxInstances = Number(process.env.MAX_INSTANCES || 1);

//
// Build browser capabilities
//
const buildCapabilities = () => {
  //
  // Shared capability
  //
  const capability = {
    browserName,

    //
    // WDIO v9 + Selenium Grid stability
    //
    ...(useGrid
      ? {
        'wdio:enforceWebDriverClassic': true
      }
      : {})
  };

  //
  // Chrome / Chromium
  //
  if (browserName === 'chrome') {
    capability['goog:chromeOptions'] = {
      args: [
        '--disable-gpu',

        `--window-size=${process.env.WINDOW_WIDTH || 1920
        },${process.env.WINDOW_HEIGHT || 1080
        }`,

        ...(useGrid
          ? [
            '--no-sandbox',
            '--disable-dev-shm-usage'
          ]
          : []),

        ...(isHeadless
          ? ['--headless=new']
          : [])
      ]
    };
  }

  //
  // Firefox
  //
  if (browserName === 'firefox') {
    capability['moz:firefoxOptions'] = {
      args: [
        '-width=1920',
        '-height=1080',

        ...(isHeadless
          ? ['-headless']
          : [])
      ]
    };
  }

  return [capability];
};

//
// Build services
//
const buildServices = () => {
  //
  // Selenium Grid mode
  //
  if (useGrid) {
    return [];
  }

  //
  // Local native browser mode
  //
  if (browserName === 'chrome') {
    return ['chromedriver'];
  }

  if (browserName === 'firefox') {
    return ['geckodriver'];
  }

  return [];
};

export const config = {
  //
  // Runner
  //
  runner: 'local',

  //
  // Feature files
  //
  specs: ['./test/features/**/*.feature'],

  //
  // Parallel execution
  //
  maxInstances,

  //
  // Browser capabilities
  //
  capabilities: buildCapabilities(),

  //
  // Selenium Grid
  //
  ...(useGrid
    ? {
      hostname: process.env.SELENIUM_HOST || 'localhost',

      port: Number(process.env.SELENIUM_PORT || 4444),

      //
      // Selenium Grid 4 modern endpoint
      //
      path: '/'
    }
    : {}),

  //
  // Logging
  //
  logLevel: process.env.LOG_LEVEL || 'info',

  //
  // Stop execution after X failures
  //
  bail: 0,

  //
  // Base URL
  //
  baseUrl: envConfig.baseUrl,

  //
  // Wait timeout
  //
  waitforTimeout: Number(
    process.env.WAIT_FOR_TIMEOUT || 10000
  ),

  //
  // Retry timeout
  //
  connectionRetryTimeout: 120000,

  //
  // Retry count
  //
  connectionRetryCount: 3,

  //
  // Services
  //
  services: buildServices(),

  //
  // Framework
  //
  framework: 'cucumber',

  //
  // Reporters
  //
  reporters: [
    'spec',

    [
      'allure',

      {
        outputDir: 'allure-results',

        //
        // Disable webdriver steps in report
        //
        disableWebdriverStepsReporting: true,

        //
        // Keep screenshots
        //
        disableWebdriverScreenshotsReporting: false,

        //
        // Better cucumber report
        //
        useCucumberStepReporter: true,

        disableMochaHooks: false,

        //
        // Environment info
        //
        reportedEnvironmentVars: {
          Environment: testEnv,

          Base_URL: envConfig.baseUrl,

          Browser: browserName,

          Headless: String(isHeadless),

          Use_Grid: String(useGrid),

          Selenium_Host:
            process.env.SELENIUM_HOST || 'localhost',

          Selenium_Port:
            process.env.SELENIUM_PORT || '4444',

          Node_Version: process.version
        }
      }
    ]
  ],

  //
  // Cucumber config
  //
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

    timeout: Number(
      process.env.STEP_TIMEOUT || 60000
    ),

    ignoreUndefinedDefinitions: false
  },

  //
  // Before all tests
  //
  before: async function () {

    //
    // Window size from ENV
    //
    const width = Number(
      process.env.WINDOW_WIDTH || 1920
    );

    const height = Number(
      process.env.WINDOW_HEIGHT || 1080
    );

    //
    // Selenium Grid / Docker
    //
    if (process.env.USE_GRID === 'true') {

      await browser.setWindowSize(width, height);

      return;
    }

    //
    // Local Native Browser
    //
    await browser.maximizeWindow();

  },

  //
  // Before scenario
  //
  beforeScenario: async function (world) {
    const scenarioName =
      world?.pickle?.name || 'Unnamed Scenario';

    const featureFilePath =
      world?.pickle?.uri ||
      world?.gherkinDocument?.uri;

    const feature =
      getFeatureMetadata(featureFilePath);

    const background =
      getBackgroundMetadata(featureFilePath);

    const tags =
      getScenarioTagsFromWorld(world);

    //
    // Allure metadata
    //
    allureReporter.addLabel(
      'environment',
      testEnv
    );

    allureReporter.addLabel(
      'browser',
      browserName
    );

    allureReporter.addLabel(
      'baseUrl',
      envConfig.baseUrl
    );

    allureReporter.addStory(scenarioName);

    if (feature?.name) {
      allureReporter.addFeature(feature.name);
    }

    if (background?.name) {
      allureReporter.addLabel(
        'background',
        background.name
      );
    }

    for (const tag of tags) {
      allureReporter.addTag(tag);
    }
  },

  //
  // Screenshot after every step
  //
  afterStep: async function () {
    await browser.takeScreenshot();
  },

  //
  // After scenario
  //
  afterScenario: async function (
    world,
    result
  ) {
    const rawScenarioName =
      world?.pickle?.name ||
      'Unnamed Scenario';

    const featureFilePath =
      world?.pickle?.uri ||
      world?.gherkinDocument?.uri;

    const feature =
      getFeatureMetadata(featureFilePath);

    const background =
      getBackgroundMetadata(featureFilePath);

    const scenarioSteps =
      getScenarioStepsFromWorld(world);

    const tags =
      getScenarioTagsFromWorld(world);

    //
    // Execution metadata
    //
    const scenarioData = {
      feature,

      background,

      scenario: {
        name: rawScenarioName,

        tags,

        steps: scenarioSteps
      },

      result: {
        status: result?.passed
          ? 'PASSED'
          : 'FAILED',

        duration:
          result?.duration || null
      },

      environment: {
        name: testEnv,

        baseUrl: envConfig.baseUrl,

        browser: browserName,

        headless: String(isHeadless),

        useGrid: String(useGrid),

        seleniumHost:
          process.env.SELENIUM_HOST ||
          'localhost',

        seleniumPort:
          process.env.SELENIUM_PORT ||
          '4444',

        nodeVersion: process.version
      },

      timestamp: new Date().toISOString()
    };

    //
    // Save metadata
    //
    saveExecutionMetadata(scenarioData);

    //
    // Screenshot on failure
    //
    if (!result?.passed) {
      await browser.takeScreenshot();
    }
  }
};