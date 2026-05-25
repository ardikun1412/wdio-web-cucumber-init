/**
 * Xray Test Set Management
 *
 * Handles CRUD operations for Jira Xray Test Set issues.
 * Test Sets group related Test Cases (e.g., by feature).
 */

import {
  axios,
  auth,
  JIRA_BASEURL,
  JIRA_USERNAME,
  PROJECT_TCM_KEY,
  issueTypes,
  getOldestIssue,
  findIssueBySummary
} from './client.js';

async function findTestSetBySummary(summary) {
  return findIssueBySummary(issueTypes.testSet, summary);
}

async function createTestSet(summary, description) {
  const fields = {
    project: { key: PROJECT_TCM_KEY },
    summary,
    issuetype: { name: issueTypes.testSet },
    assignee: { name: JIRA_USERNAME }
  };

  if (description) {
    fields.description = description;
  }

  const body = { fields };

  const res = await axios.post(
    `${JIRA_BASEURL}/rest/api/2/issue`,
    body,
    { auth }
  );

  console.log(`Created Test Set: ${res.data.key} - ${summary}`);

  return res.data.key;
}

async function updateTestSet(testSetKey, description) {
  if (!description) return;

  const body = {
    fields: {
      description
    }
  };

  try {
    await axios.put(
      `${JIRA_BASEURL}/rest/api/2/issue/${testSetKey}`,
      body,
      { auth }
    );
    console.log(`Updated Test Set ${testSetKey} description`);
  } catch (err) {
    console.error(
      `Failed to update Test Set ${testSetKey} description:`,
      err.response?.data || err.message
    );
  }
}

async function getOrCreateTestSet(tc) {
  const summary = tc.featureName || 'Uncategorized Feature';
  const description = tc.featureDescription || null;

  const existing = await findTestSetBySummary(summary);

  if (existing) {
    console.log(`Using existing Test Set: ${existing} - ${summary}`);
    await updateTestSet(existing, description);
    return existing;
  }

  return await createTestSet(summary, description);
}

async function isTestInTestSet(testSetKey, testKey) {
  try {
    const res = await axios.get(
      `${JIRA_BASEURL}/rest/raven/1.0/api/testset/${testSetKey}/test`,
      { auth }
    );

    return res.data.some(test => test.key === testKey);

  } catch (err) {
    console.error(
      `Failed to check whether ${testKey} exists in Test Set ${testSetKey}:`,
      err.response?.data || err.message
    );

    return false;
  }
}

async function addTestToTestSet(testSetKey, testKey) {
  try {
    const alreadyExists = await isTestInTestSet(testSetKey, testKey);

    if (alreadyExists) {
      console.log(`Test Case ${testKey} already exists in Test Set ${testSetKey}`);
      return;
    }

    await axios.post(
      `${JIRA_BASEURL}/rest/raven/1.0/api/testset/${testSetKey}/test`,
      { add: [testKey] },
      { auth }
    );

    console.log(`Linked Test Case ${testKey} to Test Set ${testSetKey}`);

  } catch (err) {
    console.error(
      `Failed to link Test Case ${testKey} to Test Set ${testSetKey}:`,
      err.response?.data || err.message
    );
  }
}

export {
  getOrCreateTestSet,
  addTestToTestSet
};
