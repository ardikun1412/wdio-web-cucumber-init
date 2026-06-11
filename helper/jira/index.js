/**
 * Main Jira/Xray Upload Orchestrator
 *
 * Replaces the original 1084-line subTestExecution.helper.js.
 * Orchestrates the flow of parsing Allure results and syncing
 * them with Jira Xray Pre-Conditions, Test Cases, Test Sets,
 * Test Executions, and Evidence.
 */

import { fileURLToPath } from 'url';
import { validateRequiredEnv, login } from './client.js';
import { extractAllureData } from './allure-reader.js';
import { getOrCreatePrecondition, linkPreconditionToTest } from './precondition.js';
import { getOrCreateTestCase } from './test-case.js';
import { getOrCreateTestSet, addTestToTestSet } from './test-set.js';
import { uploadExecutionEvidence, updateTestRunStatus } from './evidence.js';
import {
  initTestExecution,
  refreshTestInExecution
} from './test-execution.js';

async function uploadtojira() {
  console.log('\n================================================================');
  console.log('📤 STARTING JIRA XRAY UPLOAD PROCESS');
  console.log('================================================================');

  validateRequiredEnv();

  await login();

  const testExecKey = await initTestExecution();
  const tests = await extractAllureData();

  if (!tests.length) {
    console.warn('No Allure test results found. Nothing to upload.');
    return;
  }

  console.log(`Found ${tests.length} test result(s) from Allure.`);

  for (let i = 0; i < tests.length; i++) {
    const tc = tests[i];

    try {
      console.log('\n================================================================');
      console.log(`🚀 Processing Scenario [${i + 1}/${tests.length}]`);
      console.log('================================================================');
      console.log(`🎬 Scenario   : ${tc.name}`);
      console.log(`📄 Feature    : ${tc.featureName}`);
      console.log(`🕒 Timestamp  : ${tc.timestamp || '-'}`);
      console.log(`📁 Source     : ${tc.enrichedFile}`);
      console.log('----------------------------------------------------------------');

      const testSetKey = await getOrCreateTestSet(tc);
      const testKey = await getOrCreateTestCase(tc);

      if (!testKey) {
        console.error(`Cannot process scenario "${tc.name}" because Test Case key is empty.`);
        continue;
      }

      const preconditionKey = await getOrCreatePrecondition(tc);

      if (preconditionKey) {
        await linkPreconditionToTest(preconditionKey, testKey);
      }

      if (testSetKey) {
        await addTestToTestSet(testSetKey, testKey);
      }

      /**
       * Safe refresh:
       * - Does not call GET /testexec/{key}/test
       * - Does not clear the whole Test Execution
       * - Removes only the current Test Case if it exists
       * - Adds the current Test Case back to the Test Execution
       */
      await refreshTestInExecution(testExecKey, testKey);

      const status = tc.status;

      await updateTestRunStatus(testExecKey, testKey, status);

      await uploadExecutionEvidence(testExecKey, testKey, tc.screenshots);

    } catch (err) {
      console.error(
        `Failed processing Test Case "${tc.name}":`,
        err.response?.data || err.message
      );
    }
  }

  console.log('\n================================================================');
  console.log('✅ XRAY UPLOAD COMPLETED SUCCESSFULLY');
  console.log('================================================================\n');
}

export { uploadtojira };

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  uploadtojira().catch(err => {
    console.error(
      'Upload to Jira failed:',
      err.response?.data || err.message
    );

    process.exit(1);
  });
}