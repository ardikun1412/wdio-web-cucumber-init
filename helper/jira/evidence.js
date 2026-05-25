/**
 * Xray Evidence Management
 *
 * Handles fetching Test Run IDs, converting screenshots to base64,
 * uploading evidence, and updating Test Run statuses.
 */

import fs from 'fs';
import fsa from 'fs/promises';
import {
  axios,
  auth,
  JIRA_BASEURL
} from './client.js';
import { sanitizeFileName } from '../../utils/sanitize.js';

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

export {
  uploadExecutionEvidence,
  updateTestRunStatus
};
