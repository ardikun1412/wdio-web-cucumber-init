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

async function createSubTestExecution() {
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

async function initSubTestExecution() {
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

  TEST_EXEC_KEY = await createSubTestExecution();

  console.log(`✨ Created Test Execution: ${TEST_EXEC_KEY}`);

  return TEST_EXEC_KEY;
}

/**
 * Deprecated behavior:
 * Do not use GET /rest/raven/1.0/api/testexec/{testExecKey}/test
 * for large Test Executions because it can exceed Jira/Xray maximum result limit.
 *
 * This function is kept for backward compatibility only.
 * Prefer refreshTestInExecution().
 */
async function isTestInExecution(testExecKey, testKey) {
  console.warn(
    `⚠ isTestInExecution(${testExecKey}, ${testKey}) is skipped to avoid Xray max result limit. ` +
    `Use refreshTestInExecution() instead.`
  );

  return false;
}

function isTestRunNotFoundError(error) {
  const status = error.response?.status;
  const data = error.response?.data;

  const message =
    typeof data === 'string'
      ? data
      : data?.message || error.message || '';

  return (
    status === 404 ||
    message.includes("Can't find test run") ||
    message.includes('Cannot find test run') ||
    message.includes('could not find test run') ||
    (message.toLowerCase().includes('test run') &&
      message.toLowerCase().includes('not found'))
  );
}

async function deleteTestCaseFromExecution(testExecKey, testCaseKey) {
  try {
    await axios.delete(
      `${JIRA_BASEURL}/rest/raven/1.0/api/testexec/${testExecKey}/test/${testCaseKey}`,
      { auth }
    );

    console.log(`  ➖ Removed Test Case ${testCaseKey} from Test Execution ${testExecKey}`);

  } catch (error) {
    if (isTestRunNotFoundError(error)) {
      console.log(
        `  ℹ Test Case ${testCaseKey} is not currently in Test Execution ${testExecKey}, skip remove`
      );
      return;
    }

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

/**
 * Safe refresh for one Test Case only.
 * This does NOT clear the whole Test Execution.
 *
 * It removes only the current Test Case if it exists,
 * then adds it back to regenerate/refresh the Test Run.
 */
async function refreshTestInExecution(testExecKey, testKey) {
  await deleteTestCaseFromExecution(testExecKey, testKey);
  await addTestToExecution(testExecKey, testKey);
}

export {
  initSubTestExecution,
  isTestInExecution,
  deleteTestCaseFromExecution,
  addTestToExecution,
  refreshTestInExecution
};