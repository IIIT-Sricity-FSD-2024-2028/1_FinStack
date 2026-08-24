import configuration from './configuration';

describe('configuration', () => {
  const originalLogLevel = process.env.LOG_LEVEL;
  const originalLogMaxSize = process.env.LOG_MAX_SIZE;
  const originalUploadDirectory = process.env.UPLOAD_DIRECTORY;
  const originalUploadMaxSize = process.env.UPLOAD_MAX_SIZE_MB;

  afterEach(() => {
    restoreEnvironmentValue('LOG_LEVEL', originalLogLevel);
    restoreEnvironmentValue('LOG_MAX_SIZE', originalLogMaxSize);
    restoreEnvironmentValue('UPLOAD_DIRECTORY', originalUploadDirectory);
    restoreEnvironmentValue('UPLOAD_MAX_SIZE_MB', originalUploadMaxSize);
  });

  it('rejects an unsupported LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'trace';

    expect(configuration).toThrow(
      'Invalid LOG_LEVEL "trace". Expected one of: error, warn, info, http, verbose, debug, silly.',
    );
  });

  it('rejects a malformed LOG_MAX_SIZE', () => {
    process.env.LOG_LEVEL = 'info';
    process.env.LOG_MAX_SIZE = 'twenty-megabytes';

    expect(configuration).toThrow(
      'Invalid LOG_MAX_SIZE "twenty-megabytes". Use a positive size such as 20m or 1g.',
    );
  });

  it.each(['0', '-1', 'not-a-number'])(
    'rejects invalid UPLOAD_MAX_SIZE_MB value %s',
    (value) => {
      process.env.UPLOAD_MAX_SIZE_MB = value;
      expect(configuration).toThrow(
        `Invalid UPLOAD_MAX_SIZE_MB "${value}". Expected a positive number.`,
      );
    },
  );

  it('uses bounded upload defaults and resolves relative paths from the backend root', () => {
    delete process.env.UPLOAD_DIRECTORY;
    delete process.env.UPLOAD_MAX_SIZE_MB;

    const config = configuration();
    expect(config.upload.maxSizeMb).toBe(5);
    expect(config.upload.maxSizeBytes).toBe(5 * 1024 * 1024);
    expect(config.upload.directory.replace(/\\/g, '/')).toMatch(
      /\/back-end\/uploads\/receipts$/,
    );
  });
});

function restoreEnvironmentValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
