import "reflect-metadata";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

function parseCorsOrigins(): boolean | (string | RegExp)[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd) return true;
    return [
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      /^tauri:\/\/.+/,
      /^https?:\/\/tauri\.localhost(:\d+)?$/,
    ];
  }
  if (raw === "*") return true;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.enableCors({
    origin: parseCorsOrigins(),
    credentials: true,
  });
  app.useStaticAssets(join(process.cwd(), "data", "uploads"), { prefix: "/uploads/" });
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen(port, host);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
