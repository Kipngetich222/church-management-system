import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ChurchGuard } from '../../common/guards/church.guard'
import type { MembershipSummary } from '../../common/interfaces/auth-user.interface'
import type { SupabaseService } from '../../supabase/supabase.service'
import { VolunteersController } from './volunteers.controller'
import { VolunteersGuard } from './volunteers.guard'

describe('Volunteer permissions', () => {
  const membership: MembershipSummary = {
    id: 'membership',
    churchId: 'church',
    role: 'dept_admin',
    status: 'active',
    badges: [],
    isBaptized: false,
  }
  const context = (
    method: keyof VolunteersController,
    changes: Partial<MembershipSummary> = {}
  ) => {
    const current = { ...membership, ...changes }
    const request = {
      membership: current,
      user: { memberships: [current] },
      params: { churchId: 'church' },
      headers: {},
    }
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => VolunteersController.prototype[method],
      getClass: () => VolunteersController,
    } as unknown as ExecutionContext
  }
  const guard = (permissions: string[]) => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest
        .fn()
        .mockResolvedValue({ data: { permissions }, error: null }),
    }
    const supabase = {
      admin: { from: jest.fn(() => query) },
      unwrap: jest.fn((data) => data),
    }
    return {
      instance: new VolunteersGuard(
        new Reflector(),
        supabase as unknown as SupabaseService
      ),
      supabase,
      query,
    }
  }

  it('lets read-only admins view rosters but blocks creation and editing', async () => {
    const { instance, query } = guard(['volunteers:read'])
    await expect(
      instance.canActivate(context('listParticipants'))
    ).resolves.toBe(true)
    for (const method of ['createRole', 'createShift', 'updateShift'] as const)
      await expect(instance.canActivate(context(method))).rejects.toThrow(
        'Insufficient volunteer permissions'
      )
    expect(query.eq).toHaveBeenCalledWith('church_id', 'church')
    expect(query.eq).toHaveBeenCalledWith('role', 'dept_admin')
  })

  it('respects granted and revoked volunteer administration permissions', async () => {
    await expect(
      guard(['volunteers:*']).instance.canActivate(context('updateShift'))
    ).resolves.toBe(true)
    await expect(
      guard([]).instance.canActivate(context('listParticipants'))
    ).rejects.toThrow('Insufficient volunteer permissions')
  })

  it('blocks inactive admins before accessing participant data', async () => {
    const { instance, supabase } = guard(['volunteers:*'])
    await expect(
      instance.canActivate(context('listParticipants', { status: 'inactive' }))
    ).rejects.toThrow('active membership')
    expect(supabase.admin.from).not.toHaveBeenCalled()
  })

  it('lets active members browse and manage their own participation without admin permissions', async () => {
    const { instance, supabase } = guard([])
    for (const method of [
      'listRoles',
      'listShifts',
      'signUp',
      'cancel',
    ] as const)
      await expect(
        instance.canActivate(context(method, { role: 'member' }))
      ).resolves.toBe(true)
    expect(supabase.admin.from).not.toHaveBeenCalled()
  })

  it('requires a super admin to delete an activity, matching the web screen', () => {
    const churchGuard = new ChurchGuard(new Reflector())
    expect(() => churchGuard.canActivate(context('removeShift'))).toThrow(
      'Insufficient permissions'
    )
    expect(
      churchGuard.canActivate(context('removeShift', { role: 'super_admin' }))
    ).toBe(true)
  })
})
