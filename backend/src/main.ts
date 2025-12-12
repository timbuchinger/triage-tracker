import * as dotenv from "dotenv";
dotenv.config();
import ConfigService from "./config/config.service";

// Ensure a service-specific OTEL_SERVICE_NAME is available before initializing tracing.
// We compute it from the centralized config service so all env access is consistent.
const config = ConfigService;
if (!process.env.OTEL_SERVICE_NAME) {
  process.env.OTEL_SERVICE_NAME = config.otelServiceName;
}

// Validate required Slack environment variables early and fail fast if missing.
const missingSlackVars = config.validateRequired(["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"]);
if (missingSlackVars.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`Missing required Slack environment variables: ${missingSlackVars.join(", ")}`);
  // eslint-disable-next-line no-process-exit
  process.exit(1);
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
    origin: [
      'http://localhost:5173',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
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
  const startupLogger = new (require("./otel-logger.service").OtelLoggerService)("NestApplication");
  startupLogger.log(`Triage Tracker API running on http://localhost:${port}/api`);
}

bootstrap();
