import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { manualQaSettings } from './manual-qa';
import { AppConfiguration } from './configuration';

export function configureHttpApplication(app: INestApplication): void {
  if (manualQaSettings()) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
      let originAllowed = true;
      try {
        if (req.headers.origin)
          originAllowed = ['127.0.0.1', 'localhost', '[::1]'].includes(
            new URL(req.headers.origin).hostname,
          );
      } catch {
        originAllowed = false;
      }
      if (
        !loopback.includes(req.socket.remoteAddress || '') ||
        !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(req.hostname) ||
        !originAllowed
      ) {
        res.status(403).json({ message: 'Manual QA is local-only.' });
        return;
      }
      next();
    });
  }
  const configService =
    app.get<ConfigService<AppConfiguration, true>>(ConfigService);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );

  const allowedOrigins = configService.get('corsOrigins', { infer: true });
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
