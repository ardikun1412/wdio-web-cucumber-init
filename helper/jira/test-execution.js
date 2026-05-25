/**
 * Xray Test Execution Management
 *
 * Handles Sub Test Execution lifecycle: create, validate,
 * add/remove test cases, and manage test run status.
 */

import {
  axios,
  auth,
  JIRA_BASEURL,
  JIRA_USERNAME,
  PROJECT_KEY,
  PARENT_ISSUE_KEY,
  TEST_EXECUTION_KEY,
  SUMMARY_EXECUTION,
  issueTypes,
  isBlank,
  isJiraIssueKey,
  isJiraProjectKey,
  getIssue
} from './client.js';

let TEST_EXEC_KEY = null;

async function isSubTestExecution(issueKey) {
  if (!isJiraIssueKey(issueKey)) {
    return false;
  }

  try {
    const issue = await getIssue(issueKey);
    return issue.fields.issuetype.name === issueTypes.subTestExecution;

  } catch (error) {
    console.error(
      `Failed to check issue type for ${issueKey}:`,
      error.response?.data || error.message
    );

    throw error;
  }
}

async function createTestExecution() {
  if (!isJiraProjectKey(PROJECT_KEY)) {
    throw new Error(
      `PROJECT_KEY must be a project key, for example "POFT". Current value: ${PROJECT_KEY}`
    );
  }

  if (!isJiraIssueKey(PARENT_ISSUE_KEY)) {
    throw new Error(
      `PARENT_ISSUE_KEY is required to create Sub Test Execution, for example "POFT-123". Current value: ${PARENT_ISSUE_KEY}`
    );
  }

  const body = {
    fields: {
      project: { key: PROJECT_KEY },
      summary: SUMMARY_EXECUTION,
      issuetype: { name: issueTypes.subTestExecution },
      assignee: { name: JIRA_USERNAME },
      parent: {
        key: PARENT_ISSUE_KEY
      }
    }
  };

  const res = await axios.post(
    `${JIRA_BASEURL}/rest/api/2/issue`,
    body,
    { auth }
  );

  return res.data.key;
}

async function updateTestExecutionAssignee(testExecKey, assignee) {
  try {
    await axios.put(
      `${JIRA_BASEURL}/rest/api/2/issue/${testExecKey}`,
      {
        fields: {
          assignee: { name: assignee }
        }
      },
      { auth }
    );
  } catch (err) {
    console.error(
      `Failed to update assignee for ${testExecKey}:`,
      err.response?.data || err.message
    );
  }
}

async function initTestExecution() {
  if (!isBlank(TEST_EXECUTION_KEY)) {
    if (!isJiraIssueKey(TEST_EXECUTION_KEY)) {
      throw new Error(
        `TEST_EXECUTION_KEY must be an issue key, for example "POFT-456". Current value: ${TEST_EXECUTION_KEY}`
      );
    }

    const isValidTestExecution = await isSubTestExecution(TEST_EXECUTION_KEY);

    if (!isValidTestExecution) {
      throw new Error(`${TEST_EXECUTION_KEY} is not a Sub Test Execution issue`);
    }

    console.log(`🔹 Using existing Test Execution: ${TEST_EXECUTION_KEY}`);

    await updateTestExecutionAssignee(TEST_EXECUTION_KEY, JIRA_USERNAME);

    TEST_EXEC_KEY = TEST_EXECUTION_KEY;

    return TEST_EXEC_KEY;
  }

  console.log(`🔹 Creating new Test Execution in project ${PROJECT_KEY}`);

  TEST_EXEC_KEY = await createTestExecution();

  console.log(`✨ Created Test Execution: ${TEST_EXEC_KEY}`);

  return TEST_EXEC_KEY;
}

async function isTestInExecution(testExecKey, testKey) {
  try {
    const res = await axios.get(
      `${JIRA_BASEURL}/rest/raven/1.0/api/testexec/${testExecKey}/test`,
      { auth }
    );

    return res.data.some(test => test.key === testKey);

  } catch (err) {
    console.error(
      `Failed to check whether ${testKey} exists in ${testExecKey}:`,
      err.response?.data || err.message
    );

    return false;
  }
}

async function deleteTestCaseFromExecution(testExecKey, testCaseKey) {
  try {
    await axios.delete(
      `${JIRA_BASEURL}/rest/raven/1.0/api/testexec/${testExecKey}/test/${testCaseKey}`,
      { auth }
    );

    console.log(`  ➖ Removed Test Case ${testCaseKey} from Test Execution ${testExecKey}`);

  } catch (error) {
    console.error(
      `Error removing Test Case ${testCaseKey} from Test Execution ${testExecKey}:`,
      error.response?.data || error.message
    );
  }
}

async function addTestToExecution(testExecKey, testKey) {
  try {
    await axios.post(
      `${JIRA_BASEURL}/rest/raven/1.0/api/testexec/${testExecKey}/test`,
      { add: [testKey] },
      { auth }
    );

    console.log(`  ➕ Linked Test Case ${testKey} to Test Execution ${testExecKey}`);

  } catch (err) {
    console.error(
      `Failed to link Test Case ${testKey} to Test Execution ${testExecKey}:`,
      err.response?.data || err.message
    );
  }
}

export {
  initTestExecution,
  isTestInExecution,
  deleteTestCaseFromExecution,
  addTestToExecution
};
