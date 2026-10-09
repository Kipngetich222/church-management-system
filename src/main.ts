import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.setGlobalPrefix("api/v1", { exclude: ["health"] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const origins = config.get<string[]>("corsOrigins") ?? [];
  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Church Management API")
    .setDescription(
      "REST API for the Church Management System. Consumed by the Next.js web app and the mobile app.",
    )
    .setVersion("1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "supabase-jwt",
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = config.get<number>("port") ?? 4000;
  await app.listen(port);
}

void bootstrap();