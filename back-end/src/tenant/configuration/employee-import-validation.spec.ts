import { csvCell, validateEmployeeRow } from './employee-import-validation';
describe('employee CSV validation', () => {
  const valid = {
    employeeId: 'Ab_1.2-x',
    firstName: 'RenÃ©e',
    lastName: 'Oâ€™Connor',
    email: ' PERSON@EXAMPLE.COM ',
    department: 'Research & Development',
  };
  it('preserves supported identifiers and Unicode names while normalizing email', () => {
    expect(validateEmployeeRow(valid)).toMatchObject({
      employeeId: valid.employeeId,
      email: 'person@example.com',
      errors: [],
    });
  });
  it.each([
    'CONFIGURATION_MANAGER',
    'MANAGER',
    'FINANCE_OFFICER',
    'COMPLIANCE_OFFICER',
  ])('rejects privilege escalation: %s', (role) => {
    expect(validateEmployeeRow({ ...valid, role }).errors.join()).toContain(
      'EXPENSE_SUBMITTER only',
    );
  });
  it('checks length, controls, self-manager and required fields', () => {
    expect(
      validateEmployeeRow({
        ...valid,
        employeeId: 'x'.repeat(81),
        firstName: '\u0000',
        lastName: '',
        email: '',
        department: 'x'.repeat(121),
      }).errors,
    ).toHaveLength(5);
    expect(
      validateEmployeeRow({
        ...valid,
        managerEmployeeId: valid.employeeId,
      }).errors.join(),
    ).toContain('refers to this employee');
  });
  it.each([
    '=SUM(1)',
    ' +formula',
    '@formula',
    '-formula',
    '\tformula',
    '\rformula',
  ])('neutralizes CSV formula input %j', (value) => {
    expect(csvCell(value).startsWith('"\'')).toBe(true);
  });
  it('escapes quotes and preserves ordinary CSV values', () => {
    expect(csvCell('a"b')).toBe('"a""b"');
  });
  it('keeps NUL-containing values invalid but safe for PostgreSQL row staging', () => {
    const result = validateEmployeeRow({
      ...valid,
      employeeId: 'bad\u0000ID',
      firstName: 'An\u0000ita',
      email: 'bad\u0000@example.test',
    });
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(result)).not.toContain('\\u0000');
  });
});
