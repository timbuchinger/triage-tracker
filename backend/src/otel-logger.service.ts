import { LoggerService, LogLevel } from "@nestjs/common";

let trace: any;
let context: any;
let apiLogs: any;
let isOtelAvailable = false;

try {
  const otelApi = require("@opentelemetry/api");
  trace = otelApi.trace;
  context = otelApi.context;
  apiLogs = require("@opentelemetry/api-logs");
  isOtelAvailable = true;
} catch (err) {
  // OpenTelemetry not available, will fall back to console logging
  isOtelAvailable = false;
}

const logs = apiLogs?.logs;
const SeverityNumber = apiLogs?.SeverityNumber ?? {
  TRACE: 1,
  DEBUG: 5,
  INFO: 9,
  WARN: 13,
  ERROR: 17,
  FATAL: 21,
};

/**
 * OpenTelemetry Logger Bridge for NestJS
 *
 * Bridges NestJS's Logger interface to OpenTelemetry's Logs API.
 * This allows existing Logger calls to be automatically sent to OTel
 * with proper trace context correlation.
 * Falls back to console logging if OpenTelemetry is not available.
 */
export class OtelLoggerService implements LoggerService {
  private logger: any;
  private contextName?: string;

  constructor(contextName?: string) {
    this.contextName = contextName;
    if (isOtelAvailable && logs) {
      try {
        const loggerProvider = logs.getLoggerProvider();
        this.logger = loggerProvider.getLogger("nestjs", "1.0.0");
      } catch (err) {
        // Fall back to console logging
        this.logger = null;
      }
    } else {
      this.logger = null;
    }
  }

  private emit(severity: number, message: string, ...optionalParams: any[]) {
    const severityText = this.getSeverityText(severity);
    const formattedMessage = this.formatMessage(message, optionalParams);
    const prefix = this.contextName ? `[${this.contextName}] ` : "";

    // Always emit a readable text log to the console so local development sees logs
    // even when OTel is configured to receive structured logs/traces.
    // eslint-disable-next-line no-console
    console.log(`${prefix}[${severityText}] ${formattedMessage}`);

    // If OpenTelemetry isn't available or we don't have a logger, stop here.
    if (!this.logger || !isOtelAvailable) {
      return;
    }

    const activeSpan = trace.getActiveSpan();
    const spanContext = activeSpan?.spanContext();

    const logRecord: any = {
      severityNumber: severity,
      severityText: severityText,
      body: formattedMessage,
      attributes: {
        "service.context": this.contextName || "Application",
      },
      context: context.active(),
    };

    // Add trace context if available for correlation
    if (spanContext) {
      logRecord.attributes = {
        ...logRecord.attributes,
        "trace_id": spanContext.traceId,
        "span_id": spanContext.spanId,
        "trace_flags": spanContext.traceFlags,
      };
    }

    // Add optional params as attributes
    if (optionalParams.length > 0) {
      optionalParams.forEach((param, idx) => {
        if (param instanceof Error) {
          logRecord.attributes![`error.message`] = param.message;
          logRecord.attributes![`error.stack`] = param.stack;
          logRecord.attributes![`error.type`] = param.name;
        } else if (typeof param === "object") {
          logRecord.attributes![`param_${idx}`] = JSON.stringify(param);
        } else {
          logRecord.attributes![`param_${idx}`] = String(param);
        }
      });
    }

    this.logger.emit(logRecord);
  }

  private formatMessage(message: string, optionalParams: any[]): string {
    if (optionalParams.length === 0) return message;

    // Include simple string/number params in message, objects as separate attributes
    const simpleParams = optionalParams.filter(
      (p) => typeof p === "string" || typeof p === "number"
    );

    if (simpleParams.length > 0) {
      return `${message} ${simpleParams.join(" ")}`;
    }

    return message;
  }

  private getSeverityText(severity: number): string {
    if (severity >= SeverityNumber.ERROR) return "ERROR";
    if (severity >= SeverityNumber.WARN) return "WARN";
    if (severity >= SeverityNumber.INFO) return "INFO";
    if (severity >= SeverityNumber.DEBUG) return "DEBUG";
    return "TRACE";
  }

  log(message: any, ...optionalParams: any[]) {
    this.emit(SeverityNumber.INFO, String(message), ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.emit(SeverityNumber.ERROR, String(message), ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.emit(SeverityNumber.WARN, String(message), ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.emit(SeverityNumber.DEBUG, String(message), ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.emit(SeverityNumber.TRACE, String(message), ...optionalParams);
  }

  setLogLevels?(levels: LogLevel[]): void {
    // NestJS interface method - we don't need to implement filtering here
    // as OTel backend can handle log level filtering
  }
}
