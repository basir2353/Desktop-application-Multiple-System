import "reflect-metadata";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const isProd = process.env.NODE_ENV === "production";
  app.enableCors({
    // Dev: reflect any origin (Tauri/Vite ports and schemes) so the desktop shell can always call the API.
    origin: isProd ? [/http:\/\/localhost:\d+/, /http:\/\/127\.0\.0\.1:\d+/] : true,
    credentials: true,
  });
  app.useStaticAssets(join(process.cwd(), "data", "uploads"), { prefix: "/uploads/" });
  // Validation is done with Zod in controllers / services — avoid global ValidationPipe (requires class-validator).
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
