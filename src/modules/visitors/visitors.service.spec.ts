import {
  HttpException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { ChurchGuard } from '../../common/guards/church.guard'
import type { SupabaseService } from '../../supabase/supabase.service'
import {
  CreateVisitorDto,
  RegisterVisitorDto,
  VisitorCommentDto,
} from './visitor.dto'
import { VisitorsController } from './visitors.controller'
import { VisitorsService } from './visitors.service'

// PNG encoding is exercised with the real renderer by web/test/visitors.test.mjs.
// Keep this service test focused on authorization and the generated link.
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,test-qr'),
}))

describe('Visitor API', () => {
  const church = '00000000-0000-4000-8000-000000000100'
  const token = '00000000-0000-4000-8000-000000000200'
  const session = 'ab'.repeat(32)
  let query: Record<string, jest.Mock>
  let rpc: jest.Mock
  let forUser: jest.Mock
  let service: VisitorsService

  beforeEach(() => {
    query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: { token, church_id: church }, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    }
    rpc = jest.fn().mockResolvedValue({ data: null, error: null })
    forUser = jest.fn().mockReturnValue({ from: () => query, rpc: () => query })
    service = new VisitorsService(
      { forUser, admin: { rpc } } as unknown as SupabaseService,
      { get: () => 'https://church.example.test/' } as unknown as ConfigService
    )
  })

  it('keeps RLS active for protected reads and writes, including QR generation', async () => {
    await expect(service.list(church, 'Bearer admin-jwt')).resolves.toEqual([])
    const qr = await service.ensureQr(church, 'Bearer admin-jwt')
    expect(qr.url).toBe(`https://church.example.test/visit/${token}`)
    expect(qr.qr_code.startsWith('data:image/png;base64,')).toBe(true)
    expect(forUser).toHaveBeenCalledWith('admin-jwt')
    expect(rpc).not.toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('church_id', church)
  })

  it('does not write a follow-up when the visitor is outside the requested church', async () => {
    await expect(
      service.addFollowUp(
        church,
        token,
        'membership',
        { notes: 'Private follow-up' },
        'Bearer admin-jwt'
      )
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(query.insert).not.toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('church_id', church)
    expect(query.eq).toHaveBeenCalledWith('id', token)
  })

  it('requires a visitor session and rejects an unknown or expired session', async () => {
    for (const value of [undefined, '', 'invalid', 'a'.repeat(65)]) {
      await expect(service.programme(token, value)).rejects.toBeInstanceOf(
        UnauthorizedException
      )
    }
    expect(rpc).not.toHaveBeenCalled()
    await expect(service.programme(token, session)).rejects.toBeInstanceOf(
      UnauthorizedException
    )
    expect(rpc).toHaveBeenCalledWith('get_visitor_portal', {
      p_token: token,
      p_session_token: session,
    })
  })

  it('passes church and session context to comment submission and reports rate limits', async () => {
    rpc.mockResolvedValue({ data: token, error: null })
    await expect(
      service.addComment(
        token,
        { body: 'Thank you!', submissionId: token },
        session
      )
    ).resolves.toEqual({ id: token })
    expect(rpc).toHaveBeenCalledWith('add_visitor_comment', {
      p_token: token,
      p_session_token: session,
      p_body: 'Thank you!',
      p_submission_id: token,
    })
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Please wait a few minutes' },
    })
    await expect(
      service.addComment(token, { body: 'More', submissionId: token }, session)
    ).rejects.toMatchObject({ status: 429 })
  })

  it('does not return an empty page or leak database internals on an upstream failure', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'Private database details' },
    })
    await expect(service.welcome(token)).rejects.toThrow(
      new HttpException('Visitor data is temporarily unavailable', 503)
    )
  })

  it('requires super admin access on every protected visitor endpoint', () => {
    const guard = new ChurchGuard(new Reflector())
    for (const method of [
      'list',
      'create',
      'getOne',
      'getQr',
      'ensureQr',
      'updateWelcome',
      'update',
      'remove',
      'addFollowUp',
    ] as const) {
      for (const role of ['member', 'dept_admin', 'super_admin']) {
        const context = {
          switchToHttp: () => ({
            getRequest: () => ({
              user: { memberships: [{ churchId: church, role }] },
              params: { churchId: church },
              headers: {},
            }),
          }),
          getHandler: () => VisitorsController.prototype[method],
          getClass: () => VisitorsController,
        } as unknown as ExecutionContext
        if (role === 'super_admin')
          expect(guard.canActivate(context)).toBe(true)
        else
          expect(() => guard.canActivate(context)).toThrow(
            'Insufficient permissions'
          )
      }
    }
  })

  it('validates registration details and prevents public callers from setting staff fields', async () => {
    const valid = plainToInstance(RegisterVisitorDto, {
      fullName: ' Visitor ',
      sessionToken: session,
    })
    expect(
      await validate(valid, { whitelist: true, forbidNonWhitelisted: true })
    ).toHaveLength(0)
    expect(valid.fullName).toBe('Visitor')
    for (const extra of [
      { fullName: ' ' },
      { sessionToken: '' },
      { email: 'invalid' },
      { comment: 'x'.repeat(2001) },
    ]) {
      expect(
        (
          await validate(
            plainToInstance(RegisterVisitorDto, {
              fullName: 'Visitor',
              sessionToken: session,
              ...extra,
            }),
            { whitelist: true, forbidNonWhitelisted: true }
          )
        ).length
      ).toBeGreaterThan(0)
    }
    const forged = plainToInstance(RegisterVisitorDto, {
      fullName: 'Visitor',
      sessionToken: session,
      notes: 'Staff note',
      status: 'converted',
      churchId: church,
    })
    expect(await validate(forged, { whitelist: true })).toHaveLength(0)
    expect(forged).not.toHaveProperty('notes')
    expect(forged).not.toHaveProperty('status')
    expect(forged).not.toHaveProperty('churchId')
    for (const firstVisitDate of [
      '2026-02-30',
      'yesterday',
      '2026-11-04T10:00:00Z',
    ]) {
      expect(
        (
          await validate(
            plainToInstance(CreateVisitorDto, {
              fullName: 'Visitor',
              firstVisitDate,
            })
          )
        ).length
      ).toBeGreaterThan(0)
    }
    expect(
      (
        await validate(
          plainToInstance(VisitorCommentDto, {
            body: '\t\n',
            submissionId: token,
          })
        )
      ).length
    ).toBeGreaterThan(0)
  })
})
