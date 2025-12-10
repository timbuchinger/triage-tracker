import * as dotenv from "dotenv";
dotenv.config();

// Do not initialize tracing before we set a worker-specific `OTEL_SERVICE_NAME`.
// The file later sets `process.env.OTEL_SERVICE_NAME` and then requires
// `../tracing`. Requiring the tracing bootstrap earlier caused the tracing
// module to read a default service name (`triage-tracker`) from env before
// the worker-specific value (e.g. `triage-tracker-worker`) was set. Leave the
// early require out so the tracing initialization uses the correct name.
import "reflect-metadata";
// Ensure a service-specific OTEL_SERVICE_NAME is available before initializing tracing.
// Prefer `OTEL_SERVICE_NAME_PREFIX`, otherwise fall back to `SERVICE_NAME` from
// `backend/.env` and append `-worker` so the worker service name becomes
// e.g. `triage-tracker-worker`.
const baseServiceName = process.env.OTEL_SERVICE_NAME_PREFIX || process.env.SERVICE_NAME;
if (!process.env.OTEL_SERVICE_NAME) {
  if (baseServiceName && baseServiceName.trim().length > 0) {
    process.env.OTEL_SERVICE_NAME = `${baseServiceName}-worker`;
  } else {
    process.env.OTEL_SERVICE_NAME = "triage-tracker-worker";
  }
}
// Validate required Slack environment variables for worker (bot token required).
if (!process.env.SLACK_BOT_TOKEN || process.env.SLACK_BOT_TOKEN.trim().length === 0) {
  // eslint-disable-next-line no-console
  console.error("Missing required Slack environment variable: SLACK_BOT_TOKEN");
  // eslint-disable-next-line no-process-exit
  process.exit(1);
}

// Initialize OpenTelemetry before creating the worker application context
void require("../tracing");
// Test OpenTelemetry span emission removed: worker should not emit noisy
// startup test spans in production logs. Tracing initialization remains via
// `../tracing` above; production spans should be created by application
// code where appropriate.
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";
import { WorkerService } from "./worker.service";
import { OtelLoggerService } from "../otel-logger.service";

const logger = new OtelLoggerService("WorkerBootstrap");

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(WorkerModule, {
    logger: new OtelLoggerService("WorkerApplication"),
  });
  const workerService = appContext.get(WorkerService);

  logger.log("Triage Tracker worker started");
  workerService.runScheduledTasks();

  const intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS || 60000);
  const interval = setInterval(() => {
    try {
      workerService.runScheduledTasks();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error(`Worker task run failed: ${message}`, stack);
    }
  }, intervalMs);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Shutting down worker...`);
    clearInterval(interval);
    await appContext.close();
    process.exit(0);
  };

  ["SIGINT", "SIGTERM"].forEach((signal) => {
    process.once(signal, () => {
      void shutdown(signal);
    });
  });
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(`Failed to bootstrap worker: ${message}`, stack);
  process.exit(1);
});
