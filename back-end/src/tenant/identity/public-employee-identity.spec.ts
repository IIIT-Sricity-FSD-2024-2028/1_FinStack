import { publicEmployeeIdentity } from './public-employee-identity';

describe('public canonical employee identity contract', () => {
  it('returns one canonical identifier for users, managers and nested expenses without mutating service identities', () => {
    const source = {
      user: { employeeId: 'OLD-LONG', canonicalEmployeeId: 'FIC-1029' },
      items: [
        {
          employeeId: 'OLD-OTHER',
          canonicalEmployeeId: 'FIC-1030',
          managerEmployeeId: 'OLD-LONG',
          managerCanonicalEmployeeId: 'FIC-1029',
        },
      ],
    };
    expect(publicEmployeeIdentity(source)).toEqual({
      user: { employeeId: 'FIC-1029' },
      items: [{ employeeId: 'FIC-1030', managerEmployeeId: 'FIC-1029' }],
    });
    expect(source.user.employeeId).toBe('OLD-LONG');
  });
  it('preserves raw history, scalar values and non-plain response objects', () => {
    const date = new Date();
    expect(
      publicEmployeeIdentity({
        employeeId: 'historical-id',
        date,
        empty: null,
      }),
    ).toEqual({ employeeId: 'historical-id', date, empty: null });
    expect(publicEmployeeIdentity(date)).toBe(date);
  });
});
