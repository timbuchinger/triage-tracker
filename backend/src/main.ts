import * as dotenv from "dotenv";
dotenv.config();
// Ensure a service-specific OTEL_SERVICE_NAME is available before initializing tracing.
// Prefer an explicit `OTEL_SERVICE_NAME_PREFIX`, otherwise fall back to a generic
// `SERVICE_NAME` if provided in `backend/.env`. This allows users to set a single
// base service name (e.g. `triage-tracker`) and have process-specific names
// derived as `triage-tracker-api` and `triage-tracker-worker`.
const baseServiceName = process.env.OTEL_SERVICE_NAME_PREFIX || process.env.SERVICE_NAME;
if (!process.env.OTEL_SERVICE_NAME) {
  if (baseServiceName && baseServiceName.trim().length > 0) {
    process.env.OTEL_SERVICE_NAME = `${baseServiceName}-api`;
  } else {
    process.env.OTEL_SERVICE_NAME = "triage-tracker-api";
  }
  // Validate required Slack environment variables early and fail fast if missing.
  const missingSlackVars: string[] = [];
  if (!process.env.SLACK_BOT_TOKEN || process.env.SLACK_BOT_TOKEN.trim().length === 0) {
    missingSlackVars.push("SLACK_BOT_TOKEN");
  }
  if (!process.env.SLACK_SIGNING_SECRET || process.env.SLACK_SIGNING_SECRET.trim().length === 0) {
    missingSlackVars.push("SLACK_SIGNING_SECRET");
  }
  if (missingSlackVars.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Missing required Slack environment variables: ${missingSlackVars.join(", ")}`);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }

  }

  // Use require so the initializer runs after dotenv/config and after we've set the name.
  void require("./tracing");
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { json, urlencoded } from "express";
import * as cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { OtelLoggerService } from "./otel-logger.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new OtelLoggerService("NestApplication"),
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  });
  app.use(cookieParser());
  app.use(
    json({
      verify: (req: any, _res: any, buf: Buffer) => {
        req.rawBody = buf;
      }
    })
  );
  app.use(
    urlencoded({
      extended: true,
      verify: (req: any, _res: any, buf: Buffer) => {
        req.rawBody = buf;
      }
    })
  );
  app.setGlobalPrefix("api");
  const port = process.env.PORT || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Triage Tracker API running on http://localhost:${port}/api`);
}

bootstrap();
