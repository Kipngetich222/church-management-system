import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { SupabaseService } from '../../supabase/supabase.service'
import { CreateMemberDto } from './create-member.dto'
import { UpdateMemberDto } from './update-member.dto'

function isMissingMemberColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message } = error as { code?: string; message?: string }
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    Boolean(message && /column .* does not exist/i.test(message))
  )
}

@Injectable()
export class MembersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(churchId: string) {
    const run = (columns: string) =>
      this.supabase.admin
        .from('church_memberships')
        .select(columns as any)
        .eq('church_id', churchId)
        .order('joined_at', { ascending: false })

    let { data, error } = await run(
      `id, user_id, role, badges, is_baptized, status, joined_at,
       date_of_birth, gender, phone, address, full_name, email,
       category, avatar_url, is_manual,
       users!church_memberships_user_id_fkey(id, email, full_name, phone, avatar_url)`
    )

    if (error && isMissingMemberColumn(error)) {
      ;({ data, error } = await run(
        `id, user_id, role, badges, is_baptized, status, joined_at,
         date_of_birth, gender, address,
         users!church_memberships_user_id_fkey(id, email, full_name, phone, avatar_url)`
      ))
    }
    return this.supabase.unwrap(data ?? [], error)
  }

  async getOne(churchId: string, membershipId: string) {
    const run = (columns: string) =>
      this.supabase.admin
        .from('church_memberships')
        .select(columns as any)
        .eq('church_id', churchId)
        .eq('id', membershipId)
        .maybeSingle()

    let { data, error } = await run(
      '*, users!church_memberships_user_id_fkey(id, email, full_name, phone, avatar_url)'
    )
    if (error && isMissingMemberColumn(error)) {
      ;({ data, error } = await run(
        'id, user_id, role, badges, is_baptized, status, joined_at, date_of_birth, gender, address, users!church_memberships_user_id_fkey(id, email, full_name, phone, avatar_url)'
      ))
    }
    const row = this.supabase.single(data, error)
    if (!row) throw new NotFoundException('Membership not found')
    return row
  }

  async create(churchId: string, dto: CreateMemberDto, actorRole?: string) {
    let userId = dto.userId

    if (!userId && dto.email) {
      const { data: existing } = await this.supabase.admin
        .from('users')
        .select('id')
        .ilike('email', dto.email.trim())
        .maybeSingle()
      userId = existing?.id
    }

    // No existing account? Create a manual member record so the church can
    // still track and contact them (children, elderly, SMS-only members).
    if (!userId) {
      if (!dto.fullName) {
        throw new BadRequestException(
          'A full name is required when adding a member without an account.'
        )
      }

      const { data, error } = await this.supabase.admin
        .from('church_memberships')
        .insert({
          user_id: null,
          church_id: churchId,
          role: dto.role ?? 'member',
          full_name: dto.fullName,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          gender: dto.gender ?? null,
          category: (dto.category ?? null) as any,
          date_of_birth: dto.dateOfBirth ?? null,
          address: dto.address ?? null,
          is_manual: true,
          badges: (actorRole === 'super_admin' || actorRole === 'dept_admin'
            ? (dto.badges ?? [])
            : []) as any,
          is_baptized:
            actorRole === 'super_admin' ? (dto.isBaptized ?? false) : false,
        } as any)
        .select()
        .single()
      return this.supabase.unwrap(data, error)
    }

    const { data, error } = await this.supabase.admin
      .from('church_memberships')
      .insert({
        user_id: userId,
        church_id: churchId,
        role: dto.role ?? 'member',
        full_name: dto.fullName ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        gender: dto.gender ?? null,
        category: (dto.category ?? null) as any,
        date_of_birth: dto.dateOfBirth ?? null,
        address: dto.address ?? null,
        is_manual: false,
        // Badges represent a church role and are assigned by the super admin.
        badges: (actorRole === 'super_admin' || actorRole === 'dept_admin'
          ? (dto.badges ?? [])
          : []) as any,
        is_baptized:
          actorRole === 'super_admin' ? (dto.isBaptized ?? false) : false,
      } as any)
      .select()
      .single()
    return this.supabase.unwrap(data, error)
  }

  async update(
    churchId: string,
    membershipId: string,
    dto: UpdateMemberDto,
    actorRole?: string
  ) {
    const isSuperAdmin = actorRole === 'super_admin'
    const canAssignBadges =
      actorRole === 'super_admin' || actorRole === 'dept_admin'

    const { data: current, error: readError } = await this.supabase.admin
      .from('church_memberships')
      .select('id, user_id, church_id')
      .eq('church_id', churchId)
      .eq('id', membershipId)
      .maybeSingle()

    if (readError) this.supabase.unwrap(null, readError)
    if (!current) throw new NotFoundException('Membership not found')

    const userUpdate: Record<string, unknown> = {}
    if (current.user_id) {
      if (dto.fullName !== undefined) userUpdate.full_name = dto.fullName
      if (dto.phone !== undefined) userUpdate.phone = dto.phone
      if (dto.dateOfBirth !== undefined)
        userUpdate.date_of_birth = dto.dateOfBirth
      if (dto.gender !== undefined) userUpdate.gender = dto.gender
      if (dto.category !== undefined) userUpdate.category = dto.category

      if (Object.keys(userUpdate).length) {
        const { error } = await this.supabase.admin
          .from('users')
          .update(userUpdate as any)
          .eq('id', current.user_id)
        if (error) this.supabase.unwrap(null, error)
      }
    }

    const membershipUpdate: Record<string, unknown> = {
      role: dto.role,
      badges: canAssignBadges ? dto.badges : undefined,
      is_baptized: isSuperAdmin ? dto.isBaptized : undefined,
      status: dto.status,
      date_of_birth: dto.dateOfBirth,
      gender: dto.gender,
      phone: dto.phone,
      address: dto.address,
      notes: dto.notes,
    }

    // Manual members keep their contact fields on the membership row.
    if (!current.user_id) {
      if (dto.fullName !== undefined) membershipUpdate.full_name = dto.fullName
      if (dto.email !== undefined) membershipUpdate.email = dto.email
      if (dto.category !== undefined) membershipUpdate.category = dto.category
    }

    const { data, error } = await this.supabase.admin
      .from('church_memberships')
      .update(membershipUpdate as any)
      .eq('church_id', churchId)
      .eq('id', membershipId)
      .select()
      .single()
    return this.supabase.unwrap(data, error)
  }

  async remove(churchId: string, membershipId: string, actorRole?: string) {
    if (actorRole !== 'super_admin') {
      throw new ForbiddenException('Only a super admin can delete a member')
    }
    const { error } = await this.supabase.admin
      .from('church_memberships')
      .delete()
      .eq('church_id', churchId)
      .eq('id', membershipId)
    if (error) this.supabase.unwrap(null, error)
    return { success: true }
  }

  async import(
    churchId: string,
    members: CreateMemberDto[],
    actorRole?: string
  ) {
    const results = { created: 0, skipped: 0 }
    for (const member of members) {
      try {
        await this.create(churchId, member, actorRole)
        results.created += 1
      } catch {
        results.skipped += 1
      }
    }
    return results
  }
}
