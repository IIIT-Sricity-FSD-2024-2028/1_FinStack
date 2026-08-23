import configuration from './configuration';

describe('configuration', () => {
  const originalLogLevel = process.env.LOG_LEVEL;
  const originalLogMaxSize = process.env.LOG_MAX_SIZE;

  afterEach(() => {
    restoreEnvironmentValue('LOG_LEVEL', originalLogLevel);
    restoreEnvironmentValue('LOG_MAX_SIZE', originalLogMaxSize);
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
});

function restoreEnvironmentValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
