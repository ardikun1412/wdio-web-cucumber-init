import winston from 'winston';

/**
 * Loki Transport — Structured logging for WDIO tests.
 *
 * When GRAFANA_ENABLED=true, creates a Winston logger
 * with a Loki transport. Otherwise, exposes no-op
 * functions that do nothing.
 *
 * All exported helpers are safe to call regardless
 * of Loki availability — connection errors are caught
 * and logged to console.warn.
 */

const enabled =
  process.env.GRAFANA_ENABLED === 'true';

const lokiUrl =
  process.env.LOKI_URL || 'http://localhost:3100';

const projectName =
  process.env.PROJECT_NAME || 'web';

const environment =
  process.env.TEST_ENV || 'dev';

const browserName =
  process.env.BROWSER || 'chrome';

//
// ── Logger instance ──────────────────────
//

let logger;

if (enabled) {
  try {
    //
    // Dynamic import for winston-loki
    // (ESM-compatible)
    //
    const LokiTransport = (
      await import('winston-loki')
    ).default;

    logger = winston.createLogger({
      level: 'info',

      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),

      transports: [
        new LokiTransport({
          host: lokiUrl,

          labels: {
            job: 'wdio-test',
            project: projectName,
            environment,
            browser: browserName
          },

          json: true,

          //
          // Batch settings for performance
          //
          batching: true,
          interval: 5,

          //
          // Graceful error handling
          //
          onConnectionError: (err) => {
            console.warn(
              '[LokiTransport] Connection error:',
              err.message || err
            );
          }
        })
      ]
    });
  } catch (err) {
    console.warn(
      '[LokiTransport] Failed to initialise:',
      err.message || err
    );

    logger = null;
  }
}

// ─── No-op fallback ─────────────────────

const noop = () => {};

const safeLog = (level, message, meta = {}) => {
  if (!logger) return;

  try {
    logger.log({ level, message, ...meta });
  } catch (err) {
    console.warn(
      '[LokiTransport] Log error:',
      err.message || err
    );
  }
};

// ─── Exported helpers ───────────────────

/**
 * Log scenario start.
 */
export function logScenarioStart(
  scenarioName,
  featureName,
  tags
) {
  safeLog('info', 'Scenario started', {
    event: 'scenario_start',
    scenario: scenarioName,
    feature: featureName || 'Unknown Feature',
    tags: Array.isArray(tags)
      ? tags.join(', ')
      : ''
  });
}

/**
 * Log scenario end.
 * Uses 'info' for passed, 'error' for failed.
 */
export function logScenarioEnd(
  scenarioName,
  featureName,
  status,
  durationMs
) {
  const level =
    status === 'passed' ? 'info' : 'error';

  safeLog(level, 'Scenario finished', {
    event: 'scenario_end',
    scenario: scenarioName,
    feature: featureName || 'Unknown Feature',
    status,
    durationMs
  });
}

/**
 * Log step result.
 * Uses 'info' for passed, 'warn' for failed.
 */
export function logStepResult(
  stepName,
  scenarioName,
  status,
  durationMs
) {
  const level =
    status === 'passed' ? 'info' : 'warn';

  safeLog(level, 'Step result', {
    event: 'step_result',
    step: stepName,
    scenario: scenarioName,
    status,
    durationMs
  });
}

/**
 * Log suite summary.
 */
export function logSuiteSummary(
  total,
  passed,
  failed,
  skipped,
  durationMs
) {
  safeLog('info', 'Suite summary', {
    event: 'suite_summary',
    total,
    passed,
    failed,
    skipped,
    durationMs
  });
}

/**
 * Flush all pending logs before process exit.
 * Waits for the Loki transport to drain.
 */
export async function flushLogs() {
  if (!logger) return;

  try {
    await new Promise((resolve, reject) => {
      logger.on('finish', resolve);
      logger.on('error', reject);
      logger.end();
    });
  } catch (err) {
    console.warn(
      '[LokiTransport] Flush error:',
      err.message || err
    );
  }
}
