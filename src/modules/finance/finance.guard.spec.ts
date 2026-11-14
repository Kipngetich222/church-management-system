import { FinanceGuard } from './finance.guard'
import {
  givingFixture,
  givingChurch,
  givingId,
} from '../../../test/helpers/giving-fixture'

describe('Finance API permissions', () => {
  it.each([
    ['super_admin', 'active', 'GET', 'listOfferings', true],
    ['dept_admin', 'active', 'GET', 'listOfferings', false],
    ['member', 'active', 'GET', 'myGiving', true],
    ['member', 'inactive', 'GET', 'myGiving', false],
    ['super_admin', 'inactive', 'GET', 'listOfferings', false],
  ])('checks %s/%s for %s %s', async (role, status, method, name, allowed) => {
    const f = givingFixture(),
      guard = new FinanceGuard({ admin: f.db } as any)
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          membership: {
            id: givingId(1001),
            churchId: givingChurch,
            role,
            status,
          },
        }),
      }),
      getHandler: () => ({ name }),
    }
    if (allowed)
      await expect(guard.canActivate(context as any)).resolves.toBe(true)
    else await expect(guard.canActivate(context as any)).rejects.toThrow()
  })

  it.each([
    ['GET', true],
    ['HEAD', true],
    ['POST', false],
    ['PATCH', false],
    ['DELETE', false],
  ])('enforces read-only finance access for %s', async (method, allowed) => {
    const f = givingFixture()
    f.tables.role_permissions.find(
      (row) => row.role === 'dept_admin'
    )!.permissions = ['finance:read']
    const guard = new FinanceGuard({ admin: f.db } as any)
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          membership: {
            id: givingId(1006),
            churchId: givingChurch,
            role: 'dept_admin',
            status: 'active',
          },
        }),
      }),
      getHandler: () => ({ name: 'export' }),
    }
    if (allowed)
      await expect(guard.canActivate(context as any)).resolves.toBe(true)
    else await expect(guard.canActivate(context as any)).rejects.toThrow()
  })
})
