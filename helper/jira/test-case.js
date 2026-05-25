/**
 * Xray Test Case Management
 *
 * Handles CRUD operations for Jira Xray Test issues.
 * Each test case maps to a Cucumber scenario.
 */

import {
  axios,
  auth,
  JIRA_BASEURL,
  JIRA_USERNAME,
  PROJECT_TCM_KEY,
  issueTypes,
  customFields,
  defaultValues,
  addFieldIfValid,
  findIssueBySummary
} from './client.js';

async function clearStep(tc) {
  const scenarioLines = tc.scenarioText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('Scenario:'));

  return scenarioLines.join('\n');
}

function buildTestCaseFields(tc, step, includeCreateOnlyFields = false) {
  const defaultAssignee = JIRA_USERNAME;

  const fields = {
    assignee: { name: defaultAssignee }
  };

  if (includeCreateOnlyFields) {
    fields.project = { key: PROJECT_TCM_KEY };
    fields.summary = tc.name;
    fields.issuetype = { name: issueTypes.test };
  }

  // addFieldIfValid(
  //   fields,
  //   customFields.testRepositoryPath,
  //   tc.xrayRepository
  // );

  addFieldIfValid(
    fields,
    customFields.testType,
    defaultValues.testType
  );

  addFieldIfValid(
    fields,
    customFields.testingType,
    defaultValues.testingType
  );

  addFieldIfValid(
    fields,
    customFields.testingGroup,
    defaultValues.testingGroup
  );

  addFieldIfValid(
    fields,
    customFields.platform,
    defaultValues.platform
  );

  addFieldIfValid(
    fields,
    customFields.activityType,
    defaultValues.activityType
  );

  addFieldIfValid(
    fields,
    customFields.cucumberTestSteps,
    defaultValues.cucumberTestSteps
  );

  addFieldIfValid(
    fields,
    customFields.cucumberScenarioSteps,
    step
  );

  addFieldIfValid(
    fields,
    customFields.atAssignee,
    { name: defaultAssignee }
  );

  return fields;
}

async function findTestCaseBySummary(summary) {
  return findIssueBySummary(issueTypes.test, summary);
}

async function createTestCase(tc) {
  const step = await clearStep(tc);

  const body = {
    fields: buildTestCaseFields(tc, step, true)
  };

  const res = await axios.post(
    `${JIRA_BASEURL}/rest/api/2/issue`,
    body,
    { auth }
  );

  console.log(`Created Test Case: ${res.data.key} - ${tc.name}`);

  return res.data.key;
}

async function updateTestCase(testCase, tc) {
  const step = await clearStep(tc);

  const body = {
    fields: buildTestCaseFields(tc, step, false)
  };

  await axios.put(
    `${JIRA_BASEURL}/rest/api/2/issue/${testCase}`,
    body,
    { auth }
  );

  console.log(`Updated Test Case: ${testCase} - ${tc.name}`);

  return testCase;
}

async function getOrCreateTestCase(tc) {
  const existing = await findTestCaseBySummary(tc.name);

  if (existing) {
    return await updateTestCase(existing, tc);
  }

  return await createTestCase(tc);
}

export { getOrCreateTestCase };
