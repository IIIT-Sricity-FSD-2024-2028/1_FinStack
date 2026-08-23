import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { AppModule } from './app.module';
import { configureHttpApplication } from './common/config/configure-http-application';
import { AppConfiguration } from './common/config/configuration';
import { AppLoggerService } from './common/logging/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();

  const appLogger = app.get(AppLoggerService);
  const configService = app.get<ConfigService<AppConfiguration, true>>(
    ConfigService,
  );

  app.useLogger(appLogger);
  configureHttpApplication(app);

  const config = new DocumentBuilder()
    .setTitle('FinStack API')
    .setDescription('REST API for FinStack expense, policy, audit, reporting, and dashboard workflows.')
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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const swaggerPath = join(process.cwd(), 'docs', 'swagger.json');
  const swaggerDir = dirname(swaggerPath);
  if (!existsSync(swaggerDir)) {
    mkdirSync(swaggerDir, { recursive: true });
  }
  writeFileSync(swaggerPath, JSON.stringify(document, null, 2));

  await app.listen(configService.get('port', { infer: true }));
}

void bootstrap();
