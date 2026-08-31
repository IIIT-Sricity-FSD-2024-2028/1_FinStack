import { afterEach, describe, expect, it } from 'vitest';
import { clearAccessToken, getAccessToken, setAccessToken } from './session';

describe('access-token memory session', () => {
  afterEach(clearAccessToken);

  it('keeps the access token in module memory rather than Web Storage', () => {
    setAccessToken('memory-only-token');

    expect(getAccessToken()).toBe('memory-only-token');
    expect(globalThis.localStorage?.length ?? 0).toBe(0);
    expect(globalThis.sessionStorage?.length ?? 0).toBe(0);
  });
});
