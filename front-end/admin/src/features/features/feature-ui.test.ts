import { describe, expect, it } from 'vitest';
import { formatValueType } from './feature-ui';

describe('feature-ui utilities', () => {
  describe('formatValueType', () => {
    it('formats BOOLEAN correctly', () => {
      expect(formatValueType('BOOLEAN')).toBe('Boolean (True/False)');
    });

    it('formats INTEGER correctly', () => {
      expect(formatValueType('INTEGER')).toBe('Integer Number');
    });

    it('formats DECIMAL correctly', () => {
      expect(formatValueType('DECIMAL')).toBe('Decimal Number');
    });

    it('formats STRING correctly', () => {
      expect(formatValueType('STRING')).toBe('Text (String)');
    });

    it('formats JSON correctly', () => {
      expect(formatValueType('JSON')).toBe('JSON Object/Array');
    });

    it('returns the input for unknown types', () => {
      // @ts-expect-error - testing invalid enum
      expect(formatValueType('UNKNOWN')).toBe('UNKNOWN');
    });
  });
});
