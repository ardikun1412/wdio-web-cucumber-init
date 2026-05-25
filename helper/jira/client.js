/**
 * Jira/Xray Shared Client
 *
 * Provides: axios instance, auth, env variables, validation helpers,
 * and common Jira utility functions used across all Xray modules.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import jiraXrayConfig from '../../config/jira-xray.config.js';

dotenv.config();

const testEnv = process.env.TEST_ENV || 'dev';

dotenv.config({
  path: `config/${testEnv}.env`,
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

const { issueTypes, customFields, defaultValues } = jiraXrayConfig;

const auth = {
  username: JIRA_USERNAME,
  password: JIRA_PASSWORD
};

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

/* ================= COMMON JIRA UTILS ================= */

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

async function login() {
  await axios.post(`${JIRA_BASEURL}/rest/auth/1/session`, {
    username: JIRA_USERNAME,
    password: JIRA_PASSWORD
  });
}

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

/**
 * Search Jira issues by JQL and return exact match by summary.
 * Shared search pattern used by precondition, test-case, and test-set.
 */
async function findIssueBySummary(issueTypeName, summary) {
  const normalizedInput = normalizeSummary(summary);

  const jql =
    `project=${PROJECT_TCM_KEY} ` +
    `AND issuetype="${issueTypeName}" ` +
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
        `Duplicate ${issueTypeName} found with exact summary "${summary}". ` +
        `Using oldest: ${oldestKey}. Duplicates: ` +
        exactMatches.map(issue => issue.key).join(', ')
      );

      return oldestKey;
    }

    return exactMatches[0].key;

  } catch (err) {
    console.error(
      `Error finding ${issueTypeName} by summary:`,
      err.response?.data || err.message
    );

    return null;
  }
}

export {
  axios,
  auth,

  JIRA_BASEURL,
  JIRA_USERNAME,
  JIRA_PASSWORD,

  PROJECT_KEY,
  PROJECT_TCM_KEY,
  PARENT_ISSUE_KEY,
  TEST_EXECUTION_KEY,
  SUMMARY_EXECUTION,

  issueTypes,
  customFields,
  defaultValues,

  validateRequiredEnv,
  isBlank,
  isJiraIssueKey,
  isJiraProjectKey,
  addFieldIfValid,
  normalizeSummary,
  getOldestIssue,
  login,
  getIssue,
  findIssueBySummary
};
