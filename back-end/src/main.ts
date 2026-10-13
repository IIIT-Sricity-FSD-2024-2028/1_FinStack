import type { Server } from 'node:http';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { configureHttpApplication } from './common/config/configure-http-application';
import { AppConfiguration } from './common/config/configuration';
import { manualQaSettings } from './common/config/manual-qa';
import { AppLoggerService } from './common/logging/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.enableShutdownHooks();

  const appLogger = app.get(AppLoggerService);
  const configService =
    app.get<ConfigService<AppConfiguration, true>>(ConfigService);

  app.useLogger(appLogger);
  app.use(cookieParser());
  configureHttpApplication(app);

  const config = new DocumentBuilder()
    .setTitle('FinStack API')
    .setDescription(
      'REST API for FinStack expense, policy, audit, reporting, and dashboard workflows.',
    )
    .setVersion('1.0.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'role',
        in: 'header',
        description: 'RBAC role: superuser, admin, or user',
      },
      'role',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'platform-access-token',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'tenant-access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const manualQa = manualQaSettings();
  const swaggerPath = join(process.cwd(), 'docs', 'swagger.json');
  const swaggerDir = dirname(swaggerPath);
  if (!existsSync(swaggerDir)) {
    mkdirSync(swaggerDir, { recursive: true });
  }
  if (!manualQa) writeFileSync(swaggerPath, JSON.stringify(document, null, 2));

  const port = configService.get('port', { infer: true });
  if (manualQa) await app.listen(port, '127.0.0.1');
  else await app.listen(port);
  if (manualQa && process.send) {
    process.send('manual-qa-ready');
    process.on('message', (message) => {
      if (message === 'manual-qa-stop') {
        (app.getHttpServer() as Server).closeIdleConnections?.();
        void app
          .close()
          .then(() => process.disconnect())
          .catch(() => process.exit(1));
      }
    });
  }
}

void bootstrap();
