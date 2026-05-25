/**
 * Xray Pre-Condition Management
 *
 * Handles CRUD operations for Jira Xray Pre-Condition issues.
 * Pre-conditions map to Gherkin Background sections.
 */

import {
  axios,
  auth,
  JIRA_BASEURL,
  PROJECT_TCM_KEY,
  issueTypes,
  customFields,
  defaultValues,
  addFieldIfValid,
  findIssueBySummary
} from './client.js';

function buildBackgroundStepText(background) {
  if (!background?.steps?.length) return '';

  return background.steps
    .map(step => `${step.keyword || ''}${step.text || ''}`.trim())
    .join('\n');
}

function getPreconditionSummary(tc) {
  return tc.background?.name || `${tc.featureName} - Background`;
}

function buildPreconditionFields(tc, includeCreateOnlyFields = false) {
  const fields = {
    description: ''
  };

  addFieldIfValid(
    fields,
    customFields.preconditionDetails,
    buildBackgroundStepText(tc.background)
  );

  addFieldIfValid(
    fields,
    customFields.preconditionType,
    defaultValues.preconditionType
  );

  if (includeCreateOnlyFields) {
    fields.project = { key: PROJECT_TCM_KEY };

    fields.summary = getPreconditionSummary(tc);

    fields.issuetype = {
      name: issueTypes.precondition
    };
  }

  return fields;
}

async function findPreconditionBySummary(summary) {
  return findIssueBySummary(issueTypes.precondition, summary);
}

async function createPrecondition(tc) {
  const body = {
    fields: buildPreconditionFields(tc, true)
  };

  const res = await axios.post(
    `${JIRA_BASEURL}/rest/api/2/issue`,
    body,
    { auth }
  );

  console.log(
    `Created Pre-Condition: ${res.data.key} - ${getPreconditionSummary(tc)}`
  );

  return res.data.key;
}

async function updatePrecondition(preconditionKey, tc) {
  const body = {
    fields: buildPreconditionFields(tc, false)
  };

  await axios.put(
    `${JIRA_BASEURL}/rest/api/2/issue/${preconditionKey}`,
    body,
    { auth }
  );

  console.log(
    `Updated Pre-Condition: ${preconditionKey} - ${getPreconditionSummary(tc)}`
  );

  return preconditionKey;
}

async function getOrCreatePrecondition(tc) {
  if (!tc.background?.steps?.length) {
    return null;
  }

  const summary = getPreconditionSummary(tc);

  const existing = await findPreconditionBySummary(summary);

  if (existing) {
    return await updatePrecondition(existing, tc);
  }

  return await createPrecondition(tc);
}

async function linkPreconditionToTest(preconditionKey, testKey) {
  if (!preconditionKey || !testKey) return;

  try {
    await axios.post(
      `${JIRA_BASEURL}/rest/raven/1.0/api/precondition/${preconditionKey}/test`,
      {
        add: [testKey]
      },
      { auth }
    );

    console.log(
      `Linked Pre-Condition ${preconditionKey} to Test ${testKey}`
    );

  } catch (err) {
    console.error(
      `Failed to link Pre-Condition ${preconditionKey} to Test ${testKey}:`,
      err.response?.data || err.message
    );
  }
}

export {
  getOrCreatePrecondition,
  linkPreconditionToTest
};
