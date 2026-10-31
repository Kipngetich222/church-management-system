import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { Reflector } from '@nestjs/core'
import type { ExecutionContext } from '@nestjs/common'
import { ChurchGuard } from '../../common/guards/church.guard'
import { SupabaseService } from '../../supabase/supabase.service'
import { VolunteersService } from './volunteers.service'
import { VolunteersController } from './volunteers.controller'
import {
  CreateVolunteerShiftDto,
  UpdateVolunteerShiftDto,
} from './volunteer.dto'

describe('Volunteer API', () => {
  let service: VolunteersService
  let shift: Record<string, jest.Mock>
  let signup: Record<string, jest.Mock>
  let from: jest.Mock
  let rpc: jest.Mock
  let forUser: jest.Mock
  const chain = () => {
    const query: Record<string, jest.Mock> = {}
    for (const name of ['select', 'eq', 'insert', 'update', 'delete', 'order'])
      query[name] = jest.fn(() => query)
    query.single = jest
      .fn()
      .mockResolvedValue({ data: { id: 'signup' }, error: null })
    query.maybeSingle = jest.fn().mockResolvedValue({
      data: { id: 'activity', church_id: 'church' },
      error: null,
    })
    return query
  }
  beforeEach(() => {
    shift = chain()
    signup = chain()
    from = jest.fn((table: string) =>
      table === 'volunteer_shifts' ? shift : signup
    )
    const list = chain()
    list.range = jest.fn().mockResolvedValue({
      data: [{ id: 'activity', participant_count: 3, my_status: 'confirmed' }],
      error: null,
    })
    rpc = jest.fn(() => list)
    forUser = jest.fn(() => ({ rpc }))
    service = new VolunteersService({
      admin: { from },
      forUser,
      unwrap: (data: unknown, error: { message: string } | null) => {
        if (error) throw new Error(error.message)
        return data
      },
    } as unknown as SupabaseService)
  })

  it('lists counts and own participation through the caller’s authenticated database client', async () => {
    const rows = await service.listShifts('church', 'Bearer token')
    expect(forUser).toHaveBeenCalledWith('token')
    expect(rpc).toHaveBeenCalledWith('get_volunteer_activities', {
      p_church_id: 'church',
    })
    expect(rows[0].participant_count).toBe(3)
    expect(from).not.toHaveBeenCalledWith('volunteer_signups')
  })

  it.each(['signUp', 'cancelSignUp', 'listParticipants'] as const)(
    '%s rejects a shift from another church before accessing signups',
    async (method) => {
      shift.maybeSingle.mockResolvedValue({ data: null, error: null })
      await expect(
        service[method]('church', 'other-activity', 'membership')
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(shift.eq).toHaveBeenCalledWith('church_id', 'church')
      expect(shift.eq).toHaveBeenCalledWith('id', 'other-activity')
      expect(from).not.toHaveBeenCalledWith('volunteer_signups')
    }
  )

  it('returns a useful client error when a concurrent signup fills the activity', async () => {
    signup.single.mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'This activity is full' },
    })
    await expect(
      service.signUp('church', 'activity', 'membership')
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(signup.insert).toHaveBeenCalledWith({
      shift_id: 'activity',
      membership_id: 'membership',
      status: 'confirmed',
    })
    expect(signup.eq).toHaveBeenCalledWith('status', 'cancelled')
  })

  it('reports a duplicate signup as a conflict', async () => {
    signup.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    })
    await expect(
      service.signUp('church', 'activity', 'membership')
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('rejects missing venues, whitespace titles, invalid recurrence and nonpositive capacity', async () => {
    const valid = {
      title: 'Compound cleaning',
      location: 'Main gate',
      startsAt: '2099-01-01T06:00:00Z',
      endsAt: '2099-01-01T08:00:00Z',
    }
    expect(
      await validate(
        plainToInstance(CreateVolunteerShiftDto, {
          ...valid,
          slots: null,
          recurrence: 'weekly',
        })
      )
    ).toHaveLength(0)
    for (const invalid of [
      { location: undefined },
      { title: ' ' },
      { slots: 0 },
      { recurrence: 'sometimes' },
      { recurrenceUntil: '2099-02-30' },
    ]) {
      expect(
        (
          await validate(
            plainToInstance(CreateVolunteerShiftDto, { ...valid, ...invalid })
          )
        ).length
      ).toBeGreaterThan(0)
    }
  })

  it('keeps participant contact details behind the admin guard', () => {
    const guard = new ChurchGuard(new Reflector())
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { churchId: 'church' },
          headers: {},
          user: {
            memberships: [{ id: 'member', churchId: 'church', role: 'member' }],
          },
        }),
      }),
      getHandler: () => VolunteersController.prototype.listParticipants,
      getClass: () => VolunteersController,
    } as unknown as ExecutionContext
    expect(() => guard.canActivate(context)).toThrow('Insufficient permissions')
  })

  it('preserves real booleans and rejects strings in the API validation pipeline', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
    const metadata = {
      type: 'body' as const,
      metatype: UpdateVolunteerShiftDto,
    }
    for (const isActive of [true, false]) {
      const result = await pipe.transform({ isActive }, metadata)
      expect(result.isActive).toBe(isActive)
    }
    for (const isActive of ['false', 'true', 0, 1])
      await expect(
        pipe.transform({ isActive }, metadata)
      ).rejects.toBeInstanceOf(BadRequestException)
  })
})
