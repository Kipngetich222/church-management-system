import {
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as QRCode from 'qrcode'
import { SupabaseService } from '../../supabase/supabase.service'
import {
  CreateVisitorDto,
  FollowUpDto,
  RegisterVisitorDto,
  UpdateVisitorDto,
  VisitorCommentDto,
} from './visitor.dto'

@Injectable()
export class VisitorsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService
  ) {}

  private client(authorization: string) {
    return this.supabase.forUser(
      authorization.replace(/^Bearer\s+/i, '').trim()
    )
  }

  private check(error: { code?: string; message: string } | null) {
    if (!error) return
    const status =
      error.code === '42501'
        ? 403
        : error.code === 'P0002'
          ? 404
          : error.code === 'P0001'
            ? 429
            : ['22023', '23514', '23502', '22P02'].includes(error.code ?? '')
              ? 400
              : 503
    throw new HttpException(
      status === 503
        ? 'Visitor data is temporarily unavailable'
        : error.message,
      status
    )
  }

  async list(churchId: string, authorization: string, status?: string) {
    let query = this.client(authorization)
      .from('visitors')
      .select('*, visitor_comments(count)')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    this.check(error)
    return data ?? []
  }

  async getOne(churchId: string, visitorId: string, authorization: string) {
    const { data, error } = await this.client(authorization)
      .from('visitors')
      .select('*, visitor_followups(*), visitor_comments(id, body, created_at)')
      .eq('church_id', churchId)
      .eq('id', visitorId)
      .maybeSingle()
    this.check(error)
    if (!data) throw new NotFoundException('Visitor not found')
    return data
  }

  async create(churchId: string, dto: CreateVisitorDto, authorization: string) {
    const { data, error } = await this.client(authorization)
      .from('visitors')
      .insert({
        church_id: churchId,
        full_name: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        first_visit_date: dto.firstVisitDate,
        invited_by_membership_id: dto.invitedByMembershipId ?? null,
        notes: dto.notes,
        status: dto.status ?? 'new',
        source: 'manual',
      })
      .select()
      .single()
    this.check(error)
    return data
  }

  async update(
    churchId: string,
    visitorId: string,
    dto: UpdateVisitorDto,
    authorization: string
  ) {
    const { data, error } = await this.client(authorization)
      .from('visitors')
      .update({
        full_name: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        first_visit_date: dto.firstVisitDate,
        invited_by_membership_id: dto.invitedByMembershipId,
        notes: dto.notes,
        status: dto.status,
      })
      .eq('church_id', churchId)
      .eq('id', visitorId)
      .select()
      .maybeSingle()
    this.check(error)
    if (!data) throw new NotFoundException('Visitor not found')
    return data
  }

  async remove(churchId: string, visitorId: string, authorization: string) {
    const { data, error } = await this.client(authorization)
      .from('visitors')
      .delete()
      .eq('church_id', churchId)
      .eq('id', visitorId)
      .select('id')
      .maybeSingle()
    this.check(error)
    if (!data) throw new NotFoundException('Visitor not found')
    return { success: true }
  }

  async addFollowUp(
    churchId: string,
    visitorId: string,
    membershipId: string,
    dto: FollowUpDto,
    authorization: string
  ) {
    // Check both the route's church and visitor before writing a follow-up.
    await this.getOne(churchId, visitorId, authorization)
    const { data, error } = await this.client(authorization)
      .from('visitor_followups')
      .insert({
        visitor_id: visitorId,
        author_membership_id: membershipId,
        method: dto.method,
        notes: dto.notes,
      })
      .select()
      .single()
    this.check(error)
    return data
  }

  private async qr(token: string) {
    const baseUrl =
      this.config.get<string>('webAppUrl') ?? 'http://localhost:3000'
    const url = baseUrl.replace(/\/$/, '') + '/visit/' + token
    const qr_code = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 1000,
    })
    return { url, qr_code }
  }

  async getQr(churchId: string, authorization: string) {
    const { data, error } = await this.client(authorization)
      .from('visitor_portals')
      .select('*')
      .eq('church_id', churchId)
      .maybeSingle()
    this.check(error)
    return data ? { ...data, ...(await this.qr(data.token)) } : null
  }

  async ensureQr(churchId: string, authorization: string) {
    const { data, error } = await this.client(authorization)
      .rpc('ensure_visitor_portal', { p_church_id: churchId })
      .single()
    this.check(error)
    if (!data) throw new NotFoundException('Visitor QR code not found')
    return { ...data, ...(await this.qr(data.token)) }
  }

  async updateWelcome(
    churchId: string,
    message: string,
    authorization: string
  ) {
    const { data, error } = await this.client(authorization)
      .from('visitor_portals')
      .update({ welcome_message: message })
      .eq('church_id', churchId)
      .select('*')
      .maybeSingle()
    this.check(error)
    if (!data) throw new NotFoundException('Generate the visitor QR code first')
    return data
  }

  async welcome(token: string) {
    const { data, error } = await this.supabase.admin.rpc(
      'get_visitor_welcome',
      { p_token: token }
    )
    this.check(error)
    if (!data) throw new NotFoundException('Visitor welcome link not found')
    return data
  }

  async register(token: string, dto: RegisterVisitorDto) {
    const { data, error } = await this.supabase.admin.rpc(
      'register_church_visitor',
      {
        p_token: token,
        p_full_name: dto.fullName,
        p_session_token: dto.sessionToken,
        p_phone: dto.phone,
        p_email: dto.email,
        p_comment: dto.comment,
      }
    )
    this.check(error)
    return { visitorId: data }
  }

  private requireSession(session?: string) {
    if (!session || !/^[0-9a-f]{64}$/.test(session))
      throw new UnauthorizedException('A visitor session is required')
    return session
  }

  async programme(token: string, session?: string) {
    const { data, error } = await this.supabase.admin.rpc(
      'get_visitor_portal',
      {
        p_token: token,
        p_session_token: this.requireSession(session),
      }
    )
    this.check(error)
    if (!data)
      throw new UnauthorizedException(
        'Please register to view this church programme'
      )
    return data
  }

  async addComment(token: string, dto: VisitorCommentDto, session?: string) {
    const { data, error } = await this.supabase.admin.rpc(
      'add_visitor_comment',
      {
        p_token: token,
        p_session_token: this.requireSession(session),
        p_body: dto.body,
        p_submission_id: dto.submissionId,
      }
    )
    this.check(error)
    return { id: data }
  }
}
