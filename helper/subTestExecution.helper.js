import fs from 'fs';
import path from 'path';
import axios from 'axios';
import fsa from 'fs/promises';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import jiraXrayConfig from '../config/jira-xray.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const testEnv = process.env.TEST_ENV || 'dev';
const envPath = path.resolve(process.cwd(), 'config', `${testEnv}.env`);

dotenv.config({
  path: envPath,
  override: false
});

/* ================= ENV ================= */

const {
  JIRA_BASEURL,
  JIRA_USERNAME,
  JIRA_PASSWORD,

  PROJECT_KEY,
  PROJECT_TCM_KEY,
  PARENT_ISSUE_KEY,
  TEST_EXECUTION_KEY,
  SUMMARY_EXECUTION
} = process.env;

const {
  issueTypes,
  customFields,
  defaultValues
} = jiraXrayConfig;

const auth = {
  username: JIRA_USERNAME,
  password: JIRA_PASSWORD
};

/* ================= PATH ================= */

const enrichedResultsPath = path.join(

  process.cwd(),

  'allure-results',

  'enriched-results'

);

/* ================= VALIDATION ================= */

function requiredEnv(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
}

function validateRequiredEnv() {
  requiredEnv('JIRA_BASEURL', JIRA_BASEURL);
  requiredEnv('JIRA_USERNAME', JIRA_USERNAME);
  requiredEnv('JIRA_PASSWORD', JIRA_PASSWORD);
  requiredEnv('PROJECT_KEY', PROJECT_KEY);
  requiredEnv('PROJECT_TCM_KEY', PROJECT_TCM_KEY);
  requiredEnv('SUMMARY_EXECUTION', SUMMARY_EXECUTION);
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function isJiraIssueKey(value) {
  return /^[A-Z][A-Z0-9]+-\d+$/.test(String(value || '').trim());
}

function isJiraProjectKey(value) {
  return /^[A-Z][A-Z0-9]+$/.test(String(value || '').trim());
}

function addFieldIfValid(fields, fieldId, value) {
  if (!isBlank(fieldId) && value !== undefined && value !== null) {
    fields[fieldId] = value;
  }
}

/* ================= LOGIN ================= */

async function login() {
  await axios.post(`${JIRA_BASEURL}/rest/auth/1/session`, {
    username: JIRA_USERNAME,
    password: JIRA_PASSWORD
  });
}

/* ================= ALLURE ================= */

function mapAllureStatusToXray(status) {
  switch (status) {
    case 'passed':
      return 'PASS';

    case 'failed':
    case 'broken':
      return 'FAIL';

    case 'skipped':
      return 'TODO';

    default:
      return 'TODO';
  }
}

function sanitizeFileName(name) {
  return String(name || 'attachment.png')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 150);
}

async function extractAllureData() {
  if (!fs.existsSync(enrichedResultsPath)) {
    console.warn(`Enriched results folder not found: ${enrichedResultsPath}`);
    return [];
  }

  const files = fs.readdirSync(enrichedResultsPath)
    .filter(file => file.endsWith('-enriched-result.json'))
    .map(file => {
      const filePath = path.join(enrichedResultsPath, file);

      return {
        file,
        filePath,
        mtimeMs: fs.statSync(filePath).mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const results = [];

  for (const item of files) {
    let json;

    try {
      json = JSON.parse(fs.readFileSync(item.filePath, 'utf8'));
    } catch (err) {
      console.warn(`Failed to parse enriched result file: ${item.filePath}`);
      continue;
    }

    if (!json.name || !Array.isArray(json.steps)) continue;

    const screenshots = (json.evidence?.screenshots || [])
      .filter(shot => shot.exists && shot.absolutePath)
      .map((shot, index) => ({
        name:
          `step_${index + 1}_evidence` +
          `${path.extname(shot.source) || '.png'}`,

        path: shot.absolutePath,
        contentType: shot.type || 'image/png'
      }));

    const scenarioLines = (json.steps || [])
      .map(step => step.name)
      .filter(Boolean);

    results.push({
      name: json.name,

      featureName:
        json.feature?.name || 'Uncategorized Feature',

      background:
        json.background || null,

      status:
        mapAllureStatusToXray(json.status),

      scenarioText: [
        `Scenario: ${json.name}`,
        ...scenarioLines
      ].join('\n'),

      screenshots,

      enrichedFile: item.file,
      enrichedFilePath: item.filePath,
      enrichedMtimeMs: item.mtimeMs,
      start: json.start || 0,
      stop: json.stop || null,
      timestamp: json.timestamp || null
    });
  }

  return Object.values(
  results.reduce((acc, item) => {
    const existing = acc[item.name];

    const currentTime = item.start || Date.parse(item.timestamp || 0);
    const existingTime = existing
      ? existing.start || Date.parse(existing.timestamp || 0)
      : 0;

    if (!existing || currentTime > existingTime) {
      acc[item.name] = item;
    }

    return acc;
  }, {})
);
}

/* ================= PRECONDITION ================= */

function buildBackgroundStepText(background) {
  if (!background?.steps?.length) return '';

  return background.steps
    .map(step => `${step.keyword || ''}${step.text || ''}`.trim())
    .join('\n');
}

function getPreconditionSummary(tc) {
  return tc.background?.name || `${tc.featureName} - Background`;
}

async function findPreconditionBySummary(summary) {
  const normalizedInput = normalizeSummary(summary);

  const jql =
    `project=${PROJECT_TCM_KEY} ` +
    `AND issuetype="${issueTypes.precondition}" ` +
    `AND summary ~ "${normalizedInput}" ` +
    `ORDER BY created ASC`;

  try {
    const res = await axios.get(
      `${JIRA_BASEURL}/rest/api/2/search?jql=${encodeURIComponent(jql)}`,
      { auth }
    );

    if (!res.data.issues?.length) return null;

    const exactMatches = res.data.issues.filter(issue => {
      const jiraSummary = normalizeSummary(issue.fields.summary);
      return jiraSummary === normalizedInput;
    });

    if (!exactMatches.length) return null;

    return getOldestIssue(exactMatches);

  } catch (err) {
    console.error(
      'Error finding Pre-Condition by summary:',
      err.response?.data || err.message
    );

    return null;
  }
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

/* ================= TEST CASE ================= */

function normalizeSummary(summary) {
  return String(summary || '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function getOldestIssue(issues) {
  return issues.sort(
    (a, b) => new Date(a.fields.created) - new Date(b.fields.created)
  )[0].key;
}

async function findTestCaseBySummary(summary) {
  const normalizedInput = normalizeSummary(summary);

  const jql =
    `project=${PROJECT_TCM_KEY} ` +
    `AND issuetype="${issueTypes.test}" ` +
    `AND summary ~ "${normalizedInput}" ` +
    `ORDER BY created ASC`;

  try {
    const res = await axios.get(
      `${JIRA_BASEURL}/rest/api/2/search?jql=${encodeURIComponent(jql)}`,
      { auth }
    );

    if (!res.data.issues?.length) return null;

    const exactMatches = res.data.issues.filter(issue => {
      const jiraSummary = normalizeSummary(issue.fields.summary);
      return jiraSummary === normalizedInput;
    });

    if (exactMatches.length === 0) return null;

    if (exactMatches.length > 1) {
      const oldestKey = getOldestIssue(exactMatches);

      console.warn(
        `Duplicate Test Cases found with exact summary "${summary}". ` +
        `Using oldest: ${oldestKey}. Duplicates: ` +
        exactMatches.map(issue => issue.key).join(', ')
      );

      return oldestKey;
    }

    return exactMatches[0].key;

  } catch (err) {
    console.error(
      'Error finding test case by summary:',
      err.response?.data || err.message
    );

    return null;
  }
}

async function clearStep(tc) {
  const scenarioLines = tc.scenarioText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('Scenario:'));

  return scenarioLines.join('\n');
}

function buildTestCaseFields(tc, step, includeCreateOnlyFields = false) {
  // console.log('buildTestCaseFields', step);
  const defaultAssignee = JIRA_USERNAME;

  const fields = {
    assignee: { name: defaultAssignee }
  };

  if (includeCreateOnlyFields) {
    fields.project = { key: PROJECT_TCM_KEY };
    fields.summary = tc.name;
    fields.issuetype = { name: issueTypes.test };
  }

  addFieldIfValid(
    fields,
    customFields.testRepositoryPath,
    tc.xrayRepository
  );

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

/* ================= TEST EXECUTION ================= */

let TEST_EXEC_KEY = null;

async function getIssue(issueKey) {
  const res = await axios.get(
    `${JIRA_BASEURL}/rest/api/2/issue/${issueKey}`,
    {
      auth,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return res.data;
}

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

    console.log(`Using existing Test Execution: ${TEST_EXECUTION_KEY}`);

    await updateTestExecutionAssignee(TEST_EXECUTION_KEY, JIRA_USERNAME);

    TEST_EXEC_KEY = TEST_EXECUTION_KEY;

    return TEST_EXEC_KEY;
  }

  console.log(`Creating new Test Execution in project ${PROJECT_KEY}`);

  TEST_EXEC_KEY = await createTestExecution();

  console.log(`Created Test Execution: ${TEST_EXEC_KEY}`);

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

    console.log(`Removed Test Case ${testCaseKey} from Test Execution ${testExecKey}`);

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

    console.log(`Linked Test Case ${testKey} to Test Execution ${testExecKey}`);

  } catch (err) {
    console.error(
      `Failed to link Test Case ${testKey} to Test Execution ${testExecKey}:`,
      err.response?.data || err.message
    );
  }
}

/* ================= EVIDENCE ================= */

async function getTestRunId(testExecKey, testKey) {
  try {
    const url =
      `${JIRA_BASEURL}/rest/raven/1.0/api/testrun` +
      `?testExecIssueKey=${encodeURIComponent(testExecKey)}` +
      `&testIssueKey=${encodeURIComponent(testKey)}`;

    const response = await axios.get(url, { auth });

    if (response.data && response.data.id) {
      return response.data.id;
    }

    console.log(
      `No Test Run found for Test Execution ${testExecKey} and Test Case ${testKey}`
    );

    return null;

  } catch (error) {
    console.error(
      `Error fetching Test Run ID for ${testKey}:`,
      error.response?.data || error.message
    );

    return null;
  }
}

async function convert(filePath) {
  try {
    await fsa.access(filePath);

    const fileBuffer = await fsa.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');

    return String(base64Data);

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Info: attachment file not found at path "${filePath}"`);
    } else {
      console.error('Error reading file:', error);
    }

    return null;
  }
}

async function uploadExecutionEvidence(testExecKey, testKey, screenshots = []) {
  if (!screenshots.length) {
    console.log(`No screenshot evidence found for ${testKey}`);
    return;
  }

  const testrunId = await getTestRunId(testExecKey, testKey);

  if (!testrunId) {
    console.error(`Cannot find Test Run ID for ${testKey} in ${testExecKey}`);
    return;
  }

  for (const shot of screenshots) {
    try {
      if (!fs.existsSync(shot.path)) {
        console.warn(`Screenshot not found: ${shot.path}`);
        continue;
      }

      const base64Data = await convert(shot.path);

      if (!base64Data) {
        console.warn(`Cannot convert screenshot to base64: ${shot.path}`);
        continue;
      }

      const body = {
        filename: sanitizeFileName(shot.name),
        data: base64Data,
        contentType: shot.contentType || 'image/png'
      };

      await axios.post(
        `${JIRA_BASEURL}/rest/raven/1.0/api/testrun/${testrunId}/attachment`,
        body,
        { auth }
      );

      console.log(`Uploaded screenshot evidence: ${body.filename}`);

    } catch (err) {
      console.error(
        `Failed to upload screenshot ${shot.name}:`,
        err.response?.data || err.message
      );
    }
  }
}

async function updateTestRunStatus(testExecKey, testKey, status) {
  const testrunId = await getTestRunId(testExecKey, testKey);

  if (!testrunId) {
    console.error(`Cannot update status. Test Run ID not found for ${testKey}`);
    return;
  }

  try {
    await axios.put(
      `${JIRA_BASEURL}/rest/raven/1.0/api/testrun/${testrunId}`,
      { status },
      { auth }
    );

    console.log(`Updated Test Run status for ${testKey}: ${status}`);

  } catch (err) {
    console.error(
      `Failed to update Test Run ${testrunId} status:`,
      err.response?.data || err.message
    );
  }
}

/* ================= TEST SET ================= */

async function findTestSetBySummary(summary) {
  const normalizedInput = normalizeSummary(summary);

  const jql =
    `project=${PROJECT_TCM_KEY} ` +
    `AND issuetype="${issueTypes.testSet}" ` +
    `AND summary ~ "${normalizedInput}" ` +
    `ORDER BY created ASC`;

  try {
    const res = await axios.get(
      `${JIRA_BASEURL}/rest/api/2/search?jql=${encodeURIComponent(jql)}`,
      { auth }
    );

    if (!res.data.issues?.length) return null;

    const exactMatches = res.data.issues.filter(issue => {
      const jiraSummary = normalizeSummary(issue.fields.summary);
      return jiraSummary === normalizedInput;
    });

    if (exactMatches.length === 0) return null;

    if (exactMatches.length > 1) {
      const oldestKey = getOldestIssue(exactMatches);

      console.warn(
        `Duplicate Test Sets found with exact summary "${summary}". ` +
        `Using oldest: ${oldestKey}. Duplicates: ` +
        exactMatches.map(issue => issue.key).join(', ')
      );

      return oldestKey;
    }

    return exactMatches[0].key;

  } catch (err) {
    console.error(
      'Error finding Test Set by summary:',
      err.response?.data || err.message
    );

    return null;
  }
}

async function createTestSet(summary) {
  const body = {
    fields: {
      project: { key: PROJECT_TCM_KEY },
      summary,
      issuetype: { name: issueTypes.testSet },
      assignee: { name: JIRA_USERNAME }
    }
  };

  const res = await axios.post(
    `${JIRA_BASEURL}/rest/api/2/issue`,
    body,
    { auth }
  );

  console.log(`Created Test Set: ${res.data.key} - ${summary}`);

  return res.data.key;
}

async function getOrCreateTestSet(featureName) {
  const summary = featureName || 'Uncategorized Feature';

  const existing = await findTestSetBySummary(summary);

  if (existing) {
    console.log(`Using existing Test Set: ${existing} - ${summary}`);
    return existing;
  }

  return await createTestSet(summary);
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

/* ================= MAIN ================= */

async function uploadtojira() {
  console.log('Uploading Allure results to Xray...');

  validateRequiredEnv();

  await login();

  const testExecKey = await initTestExecution();
  const tests = await extractAllureData();

  if (!tests.length) {
    console.warn('No Allure test results found. Nothing to upload.');
    return;
  }

  console.log(`Found ${tests.length} test result(s) from Allure.`);

  for (const tc of tests) {
    try {
      console.log(`Processing scenario: ${tc.name}`);
      console.log(`Feature: ${tc.featureName}`);
      console.log(`Enriched file: ${tc.enrichedFile}`);
      console.log(`Enriched timestamp: ${tc.timestamp || '-'}`);
      const testSetKey = await getOrCreateTestSet(tc.featureName);
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

      const alreadyInExecution = await isTestInExecution(testExecKey, testKey);

      if (alreadyInExecution) {
        await deleteTestCaseFromExecution(testExecKey, testKey);
      }

      await addTestToExecution(testExecKey, testKey);

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

  console.log('Xray upload completed.');
}

export {
  uploadtojira
};

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