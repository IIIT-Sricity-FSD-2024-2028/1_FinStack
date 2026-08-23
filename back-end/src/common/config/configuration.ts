const LOG_LEVELS = [
  'error',
  'warn',
  'info',
  'http',
  'verbose',
  'debug',
  'silly',
] as const;

type AppLogLevel = (typeof LOG_LEVELS)[number];

export interface AppConfiguration {
  port: number;
  corsOrigins: string[];
  log: {
    level: AppLogLevel;
    directory: string;
    retentionDays: number;
    maxSize: string;
  };
  throttle: {
    ttlSeconds: number;
    limit: number;
  };
}

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function corsOrigins(value: string | undefined): string[] {
  if (!value) {
    return DEFAULT_CORS_ORIGINS;
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : DEFAULT_CORS_ORIGINS;
}

function logLevel(value: string | undefined): AppLogLevel {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return 'info';
  }

  if (LOG_LEVELS.includes(normalized as AppLogLevel)) {
    return normalized as AppLogLevel;
  }

  throw new Error(
    `Invalid LOG_LEVEL "${value}". Expected one of: ${LOG_LEVELS.join(', ')}.`,
  );
}

function logMaxSize(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return '20m';
  }

  if (/^[1-9]\d*[kmg]$/.test(normalized)) {
    return normalized;
  }

  throw new Error(
    `Invalid LOG_MAX_SIZE "${value}". Use a positive size such as 20m or 1g.`,
  );
}

export default (): AppConfiguration => ({
  port: positiveInteger(process.env.PORT, 3000),
  corsOrigins: corsOrigins(process.env.CORS_ORIGINS),
  log: {
    level: logLevel(process.env.LOG_LEVEL),
    directory: process.env.LOG_DIRECTORY?.trim() || 'logs',
    retentionDays: positiveInteger(process.env.LOG_RETENTION_DAYS, 14),
    maxSize: logMaxSize(process.env.LOG_MAX_SIZE),
  },
  throttle: {
    ttlSeconds: positiveInteger(process.env.THROTTLE_TTL_SECONDS, 60),
    limit: positiveInteger(process.env.THROTTLE_LIMIT, 120),
  },
});
