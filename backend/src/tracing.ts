import "reflect-metadata";
// Use the OtelLoggerService for consistent logging (falls back to console when OTel is unavailable)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { OtelLoggerService } = require("./otel-logger.service");
const traceLogger = new OtelLoggerService("tracing");

// Initialize OpenTelemetry only if the required packages are present and tracing
// is not explicitly disabled. This avoids test-time failures when dev deps are
// not installed in the environment running Jest.
if (process.env.DISABLE_TRACING === "true") {
  // no-op when tracing disabled
} else {
  try {
    // Use require so missing optional packages don't cause static import failures
    // during test execution.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeSDK } = require("@opentelemetry/sdk-node");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OTLPLogExporter } = require("@opentelemetry/exporter-logs-otlp-http");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LoggerProvider, BatchLogRecordProcessor } = require("@opentelemetry/sdk-logs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { logs } = require("@opentelemetry/api-logs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resource } = require("@opentelemetry/resources");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");

    const traceEndpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      "https://api.honeycomb.io/v1/traces";

    const logEndpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ||
      "https://api.honeycomb.io/v1/logs";

    // Read Honeycomb credentials only when provided. Do NOT fall back to
    // placeholder strings because that causes a header to be sent even when
    // the env var is missing, which can result in rejected/misrouted data.
    const apiKey = process.env.HONEYCOMB_API_KEY;
    const dataset = process.env.HONEYCOMB_DATASET;
    const serviceName =
      process.env.OTEL_SERVICE_NAME || process.env.OTEL_SERVICE_NAME_PREFIX || process.env.SERVICE_NAME || "triage-tracker";

    const headers: Record<string, string> = {};
    if (apiKey) headers["x-honeycomb-team"] = apiKey;
    if (dataset) headers["x-honeycomb-dataset"] = dataset;

    // Initialize trace exporter
    const traceExporter = new OTLPTraceExporter({ url: traceEndpoint, headers });

    // Initialize log exporter and provider
    const logExporter = new OTLPLogExporter({ url: logEndpoint, headers });
    const loggerProvider = new LoggerProvider({
      resource: new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: serviceName }),
    });
    loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
    logs.setGlobalLoggerProvider(loggerProvider);

    const sdk = new NodeSDK({
      resource: new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: serviceName }),
      traceExporter: traceExporter,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    // sdk.start() may return a Promise in some versions or be synchronous in others.
    try {
      const startResult: any = sdk.start();
      if (startResult && typeof startResult.then === "function") {
        startResult
          .then(() => {
            traceLogger.log("OpenTelemetry initialized (traces: " + traceEndpoint + ", logs: " + logEndpoint + ")");
          })
          .catch((err: any) => {
            traceLogger.error("OpenTelemetry failed to start:", err);
          });
      } else {
        // Synchronous start
        traceLogger.log("OpenTelemetry initialized (traces: " + traceEndpoint + ", logs: " + logEndpoint + ")");
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("OpenTelemetry failed to start:", err);
    }

    const shutdown = async () => {
      try {
        await loggerProvider.shutdown();
        await sdk.shutdown();
        traceLogger.log("OpenTelemetry shutdown complete");
      } catch (err) {
        traceLogger.error("Error shutting down OpenTelemetry:", err);
      }
    };

    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  } catch (err) {
    // If optional OpenTelemetry packages are not installed or initialization failed,
    // continue without tracing but surface the error to logs for debugging.
    traceLogger.warn("OpenTelemetry initialization failed; tracing disabled for this process.");
    traceLogger.error(err && err.stack ? err.stack : err);
  }
}

export {};
