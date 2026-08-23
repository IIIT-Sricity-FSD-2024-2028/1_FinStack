import { existsSync, mkdirSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import {
  format,
  transports,
  LoggerOptions,
  transport as WinstonTransport,
} from 'winston';
import DailyRotateFile = require('winston-daily-rotate-file');
import { AppConfiguration } from '../config/configuration';

const exceptionEventsOnly = format((info) =>
  info.exceptionEvent === true ? info : false,
);

export function createLoggerOptions(
  configService: ConfigService<AppConfiguration, true>,
): LoggerOptions {
  const configuredDirectory = configService.get('log.directory', {
    infer: true,
  });
  const directory = isAbsolute(configuredDirectory)
    ? configuredDirectory
    : resolve(process.cwd(), configuredDirectory);

  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  const retentionDays = configService.get('log.retentionDays', {
    infer: true,
  });
  const maxSize = configService.get('log.maxSize', { infer: true });
  const logLevel = configService.get('log.level', { infer: true });
  const fileFormat = format.combine(format.timestamp(), format.json());
  const configuredTransports: WinstonTransport[] = [
    new DailyRotateFile({
      dirname: directory,
      filename: 'application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: logLevel,
      maxFiles: `${retentionDays}d`,
      maxSize,
      format: fileFormat,
    }),
    new DailyRotateFile({
      dirname: directory,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'warn',
      maxFiles: `${retentionDays}d`,
      maxSize,
      format: format.combine(
        exceptionEventsOnly(),
        format.timestamp(),
        format.json(),
      ),
    }),
  ];

  if (process.env.NODE_ENV !== 'test') {
    configuredTransports.push(
      new transports.Console({
        level: logLevel,
        format: format.combine(
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          format.colorize(),
          format.printf(({ timestamp, level, message, context }) =>
            `${timestamp} ${level}${context ? ` [${String(context)}]` : ''} ${String(message)}`,
          ),
        ),
      }),
    );
  }

  return {
    level: logLevel,
    transports: configuredTransports,
  };
}
