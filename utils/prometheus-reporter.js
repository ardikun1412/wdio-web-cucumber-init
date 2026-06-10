import WDIOReporter from '@wdio/reporter';
import client from 'prom-client';

const { Registry, Counter, Histogram, Gauge, Pushgateway } = client;

/**
 * PrometheusReporter
 *
 * Custom WDIO reporter that collects Prometheus metrics
 * and pushes them to a Pushgateway at the end of the run.
 *
 * Toggle via GRAFANA_ENABLED env var.
 * Completely non-blocking — push failures are logged
 * but never crash the test suite.
 */
export default class PrometheusReporter extends WDIOReporter {
  constructor(options) {
    super(options);

    //
    // Opt-out when Grafana stack is disabled
    //
    this.enabled =
      process.env.GRAFANA_ENABLED === 'true';

    if (!this.enabled) {
      return;
    }

    //
    // Reporter options (passed from wdio.conf.js)
    //
    this.pushgatewayUrl =
      options.pushgatewayUrl ||
      process.env.PUSHGATEWAY_URL ||
      'http://localhost:9091';

    this.projectName =
      options.projectName ||
      process.env.PROJECT_NAME ||
      'web';

    this.environment =
      options.environment ||
      process.env.TEST_ENV ||
      'dev';

    this.browser =
      options.browser ||
      process.env.BROWSER ||
      'chrome';

    //
    // Unique run identifier
    //
    this.runId = process.env.WDIO_RUN_ID || `run-${Date.now()}`;
    
    //
    // Worker ID for grouping
    //
    this.workerId = `worker-${Math.random().toString(36).substr(2, 9)}`;

    //
    // Private registry — avoids collisions
    // with other workers or default registry
    //
    this.registry = new Registry();

    //
    // Default labels applied to every metric
    //
    this.registry.setDefaultLabels({
      project: this.projectName,
      run_id: this.runId
    });

    //
    // ── Metrics ────────────────────────────
    //

    this.scenarioTotal = new Counter({
      name: 'wdio_scenario_total',
      help: 'Total number of scenarios executed',
      labelNames: [
        'status',
        'feature',
        'scenario',
        'environment',
        'browser',
        'project'
      ],
      registers: [this.registry]
    });

    this.scenarioDuration = new Histogram({
      name: 'wdio_scenario_duration_seconds',
      help: 'Scenario execution duration in seconds',
      labelNames: [
        'feature',
        'scenario',
        'environment',
        'browser'
      ],
      buckets: [1, 5, 10, 30, 60, 120, 300],
      registers: [this.registry]
    });

    this.stepTotal = new Counter({
      name: 'wdio_step_total',
      help: 'Total number of steps executed',
      labelNames: [
        'status',
        'feature',
        'scenario'
      ],
      registers: [this.registry]
    });

    this.stepDuration = new Histogram({
      name: 'wdio_step_duration_seconds',
      help: 'Step execution duration in seconds',
      labelNames: [
        'feature',
        'scenario',
        'step_name'
      ],
      buckets: [0.5, 1, 5, 10, 30, 60],
      registers: [this.registry]
    });

    this.suiteDuration = new Gauge({
      name: 'wdio_suite_duration_seconds',
      help: 'Total suite execution time in seconds',
      registers: [this.registry]
    });

    this.suiteTestsTotal = new Gauge({
      name: 'wdio_suite_tests_total',
      help: 'Total number of tests executed in suite',
      registers: [this.registry]
    });

    this.suitePassedTotal = new Gauge({
      name: 'wdio_suite_passed_total',
      help: 'Total number of passed tests in suite',
      registers: [this.registry]
    });

    this.suiteFailedTotal = new Gauge({
      name: 'wdio_suite_failed_total',
      help: 'Total number of failed tests in suite',
      registers: [this.registry]
    });

    this.scenarioStatus = new Gauge({
      name: 'wdio_scenario_status',
      help: 'Latest scenario execution status',
      labelNames: [
        'scenario',
        'status',
        'failed_step',
        'environment',
        'browser'
      ],
      registers: [this.registry]
    });

    this.runTimestamp = new Gauge({
      name: 'wdio_run_timestamp_seconds',
      help: 'Unix timestamp of the test run',
      registers: [this.registry]
    });

    //
    // Internal counters for suite-level info
    //
    this._passed = 0;
    this._failed = 0;
    this._total = 0;

    //
    // Track the current suite context
    //
    this._currentFeature = '';
    this._currentScenario = '';
    this._currentFailedStep = '';
  }

  // ─── Helpers ──────────────────────────

  /**
   * Safely extract feature name from suite title.
   */
  _featureName(suite) {
    return suite?.title || 'Unknown Feature';
  }

  /**
   * Convert milliseconds to seconds.
   */
  _msToSec(ms) {
    return (ms || 0) / 1000;
  }

  // ─── WDIO Reporter Hooks ─────────────

  onSuiteStart(suite) {
    if (!this.enabled) return;

    //
    // Track feature vs scenario suites
    // Feature suites have type 'feature'
    //
    if (suite.type === 'feature') {
      this._currentFeature = suite.title || 'Unknown Feature';
    } else {
      this._currentScenario = suite.title || 'Unknown Scenario';
      this._currentFailedStep = '';
    }
  }

  onTestPass(test) {
    if (!this.enabled) return;

    this.stepTotal.inc({
      status: 'passed',
      feature: this._currentFeature,
      scenario: this._currentScenario
    });

    this.stepDuration.observe(
      {
        feature: this._currentFeature,
        scenario: this._currentScenario,
        step_name: test.title || 'Unknown Step'
      },
      this._msToSec(test.duration)
    );
  }

  onTestFail(test) {
    if (!this.enabled) return;

    this._currentFailedStep = test.title || 'Unknown Step';

    this.stepTotal.inc({
      status: 'failed',
      feature: this._currentFeature,
      scenario: this._currentScenario
    });

    this.stepDuration.observe(
      {
        feature: this._currentFeature,
        scenario: this._currentScenario,
        step_name: test.title || 'Unknown Step'
      },
      this._msToSec(test.duration)
    );
  }

  onTestSkip(test) {
    if (!this.enabled) return;

    this.stepTotal.inc({
      status: 'skipped',
      feature: this._currentFeature,
      scenario: this._currentScenario
    });
  }

  onSuiteEnd(suite) {
    if (!this.enabled) return;

    //
    // Only process scenario-level suites
    // (not the top-level feature suite)
    //
    if (suite.type === 'feature') {
      return;
    }

    const featureName = this._currentFeature;
    const scenarioName = suite.title || 'Unknown Scenario';
    const durationSec = this._msToSec(suite.duration);

    //
    // Determine scenario pass/fail
    //
    const hasFailed = suite.tests?.some(
      (t) => t.state === 'failed'
    );

    const status = hasFailed ? 'failed' : 'passed';

    //
    // Increment scenario counter
    //
    this.scenarioTotal.inc({
      status,
      feature: featureName,
      scenario: scenarioName,
      environment: this.environment,
      browser: this.browser,
      project: this.projectName
    });

    //
    // Set scenario status for table view
    //
    this.scenarioStatus.labels({
      scenario: scenarioName,
      status: status,
      failed_step: status === 'failed' ? this._currentFailedStep : '',
      environment: this.environment,
      browser: this.browser
    }).set(1);

    //
    // Observe scenario duration
    //
    this.scenarioDuration.observe(
      {
        feature: featureName,
        scenario: scenarioName,
        environment: this.environment,
        browser: this.browser
      },
      durationSec
    );

    //
    // Track suite-level totals
    //
    this._total += 1;

    if (hasFailed) {
      this._failed += 1;
    } else {
      this._passed += 1;
    }
  }

  async onRunnerEnd(runner) {
    if (!this.enabled) return;

    //
    // Set suite-level gauges
    //
    const totalDurationSec = this._msToSec(
      runner.duration
    );

    this.suiteDuration.set(totalDurationSec);

    this.suiteTestsTotal.set(this._total);
    this.suitePassedTotal.set(this._passed);
    this.suiteFailedTotal.set(this._failed);

    // Record the exact time the run finished
    this.runTimestamp.set(Date.now() / 1000);

    //
    // Push metrics to Pushgateway
    //
    try {
      const gateway = new Pushgateway(
        this.pushgatewayUrl,
        {},
        this.registry
      );

      await gateway.pushAdd({
        jobName: this.projectName,
        groupings: {
          worker: this.workerId
        }
      });

      console.log(
        '[PrometheusReporter] Metrics pushed to',
        this.pushgatewayUrl
      );
    } catch (err) {
      //
      // Non-blocking — log warning and continue
      //
      console.warn(
        '[PrometheusReporter] Failed to push metrics:',
        err.message || err
      );
    }
  }
}
