import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const configuredOrigins = configService.get<string>('CORS_ORIGIN');
  app.enableCors({
    origin: configuredOrigins
      ? configuredOrigins.split(',').map((origin) => origin.trim())
      : true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const swaggerPath = join(process.cwd(), 'docs', 'swagger.json');
  const swaggerDir = dirname(swaggerPath);
  if (!existsSync(swaggerDir)) {
    mkdirSync(swaggerDir, { recursive: true });
  }
  writeFileSync(swaggerPath, JSON.stringify(document, null, 2));

  await app.listen(configService.get<number>('PORT', 3000));
}

void bootstrap();
