import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DarajaClient, DarajaRejected } from './daraja'
import {
  callbackTokenHash,
  createCallbackToken,
  decryptGivingCredentials,
  encryptGivingCredentials,
  givingCallbackBase,
  hasGivingEncryption,
  validCallbackToken,
} from './giving-security'
import {
  DESTINATION_TYPES,
  GIVING_TYPES,
  HISTORY_STATUSES,
  PENDING_STATUSES,
  UUID_PATTERN,
  GivingError,
  givingPhone,
  paymentFailure,
  publicPayment,
  validateGiving,
  type GivingHistory,
  type GivingHistoryFilters,
  type GivingHistoryRow,
  type GivingInput,
  type GivingPayment,
  type GivingSettings,
  type GivingSettingsInput,
  type PublicGivingSettings,
  type ReceiptDetails,
} from './giving.types'

type Membership = {
  id: string
  role: string
  status: string | null
  full_name: string | null
  email: string | null
}
type Options = {
  publicUrl: string
  callbackPath: string
  encryptionKey?: string
  provider?: DarajaClient
}
type DbError = { code?: string; message: string } | null
function checked<T>({ data, error }: { data: T; error: DbError }): T {
  if (error) {
    // Provider keys, payer details and callback tokens never enter error responses.
    throw new GivingError(
      ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code ?? '')
        ? 'Giving is not available until the latest database migrations are applied.'
        : 'The giving record could not be saved or loaded. Please try again.',
      503
    )
  }
  return data
}
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/** Shared by the Nest API and Next routes; all service-role queries are scoped here. */
export class GivingEngine {
  readonly db: SupabaseClient
  readonly provider: DarajaClient
  constructor(
    client: unknown,
    private readonly options: Options
  ) {
    this.db = client as SupabaseClient
    this.provider = options.provider ?? new DarajaClient()
  }

  private async membership(
    userId: string,
    churchId: string
  ): Promise<Membership> {
    if (!UUID_PATTERN.test(churchId))
      throw new GivingError('A valid church is required.')
    const member = checked(
      await this.db
        .from('church_memberships')
        .select('id, role, status, full_name, email')
        .eq('user_id', userId)
        .eq('church_id', churchId)
        .maybeSingle()
    ) as Membership | null
    if (!member || (member.status ?? 'active') !== 'active')
      throw new GivingError(
        'An active membership in this church is required.',
        403
      )
    return member
  }
  private async financeAccess(churchId: string, member: Membership) {
    if (!['super_admin', 'dept_admin'].includes(member.role)) return false
    const role = checked(
      await this.db
        .from('role_permissions')
        .select('permissions')
        .eq('church_id', churchId)
        .eq('role', member.role)
        .maybeSingle()
    )
    const permissions: string[] = role?.permissions ?? []
    return (
      permissions.includes('finance:*') || permissions.includes('finance:read')
    )
  }
  private async settingsRow(churchId: string) {
    return checked(
      await this.db
        .from('church_giving_settings')
        .select('*')
        .eq('church_id', churchId)
        .maybeSingle()
    ) as GivingSettings | null
  }
  private settingsIssues(settings: GivingSettings): string[] {
    if (!['paybill', 'till'].includes(settings.destination_type))
      return [
        'Pochi and mobile-number STK collection need a compatible payment provider. The current Daraja connection supports enabled paybills and tills only.',
      ]
    const issues: string[] = []
    if (!settings.credentials_ciphertext)
      issues.push(
        'Add the church’s Daraja consumer key, consumer secret and STK passkey.'
      )
    if (!/^\d{5,7}$/.test(settings.business_shortcode))
      issues.push(
        'Add the M-Pesa business shortcode enabled for STK collection.'
      )
    if (!hasGivingEncryption(this.options.encryptionKey))
      issues.push(
        'The platform administrator must configure GIVING_CREDENTIALS_KEY on the server.'
      )
    if (!givingCallbackBase(this.options.publicUrl))
      issues.push(
        'The platform administrator must configure a public HTTPS address for payment callbacks.'
      )
    return issues
  }
  private publicSettings(settings: GivingSettings): PublicGivingSettings {
    const { credentials_ciphertext, ...safe } = settings
    const issues = this.settingsIssues(settings)
    return {
      ...safe,
      hasCredentials: !!credentials_ciphertext,
      ready: settings.enabled && issues.length === 0,
      issues,
    }
  }
  async getSettings(userId: string, churchId: string) {
    await this.membership(userId, churchId)
    const settings = await this.settingsRow(churchId)
    return settings ? this.publicSettings(settings) : null
  }
  async saveSettings(
    userId: string,
    churchId: string,
    input: GivingSettingsInput
  ) {
    const member = await this.membership(userId, churchId)
    if (member.role !== 'super_admin')
      throw new GivingError(
        'Only a church super admin can change where giving is received.',
        403
      )
    if (
      !DESTINATION_TYPES.includes(input.destinationType) ||
      !['sandbox', 'production'].includes(input.environment) ||
      typeof input.enabled !== 'boolean'
    )
      throw new GivingError(
        'Select a valid payment destination and environment.'
      )
    const number =
      typeof input.destinationNumber === 'string'
        ? input.destinationNumber.trim()
        : ''
    const phoneDestination = ['phone', 'pochi'].includes(input.destinationType)
    const destinationNumber = phoneDestination ? givingPhone(number) : number
    if (
      !destinationNumber ||
      (!phoneDestination && !/^\d{5,7}$/.test(destinationNumber))
    )
      throw new GivingError(
        phoneDestination
          ? 'Enter a valid Kenyan receiving mobile number.'
          : 'Enter a valid 5–7 digit paybill or till number.'
      )
    const reference = input.accountReference?.trim() ?? ''
    if (!/^[a-zA-Z0-9 -]{0,12}$/.test(reference))
      throw new GivingError(
        'The account reference must be at most 12 letters, numbers, spaces or hyphens.'
      )
    const shortcode =
      input.businessShortCode?.trim() ||
      (input.destinationType === 'paybill' ? destinationNumber : '')
    if (shortcode && !/^\d{5,7}$/.test(shortcode))
      throw new GivingError('Enter a valid M-Pesa business shortcode.')
    const previous = await this.settingsRow(churchId)
    const secrets = [
      input.consumerKey,
      input.consumerSecret,
      input.passkey,
    ].map((value) => value?.trim() ?? '')
    if (
      secrets.some(Boolean) &&
      secrets.some(
        (value) =>
          !value ||
          value.length > 512 ||
          /^(your[-_ ]|replace|changeme|<)/i.test(value)
      )
    )
      throw new GivingError(
        'Enter all three valid Daraja credentials together, or leave all three blank to keep the saved credentials.'
      )
    let encrypted = previous?.credentials_ciphertext ?? null
    if (
      previous &&
      (previous.environment !== input.environment ||
        previous.business_shortcode !== shortcode)
    )
      encrypted = null
    if (secrets.every(Boolean))
      encrypted = encryptGivingCredentials(
        {
          consumerKey: secrets[0],
          consumerSecret: secrets[1],
          passkey: secrets[2],
        },
        this.options.encryptionKey
      )
    const settings: GivingSettings = {
      church_id: churchId,
      enabled: input.enabled,
      destination_type: input.destinationType,
      destination_number: destinationNumber,
      account_reference: reference,
      business_shortcode: shortcode,
      environment: input.environment,
      credentials_ciphertext: encrypted,
      updated_at: new Date().toISOString(),
    }
    if (input.enabled) {
      const issues = this.settingsIssues(settings)
      if (issues.length) throw new GivingError(issues.join(' '), 409)
      await this.provider.accessToken(this.account(settings))
    }
    checked(
      await this.db
        .from('church_giving_settings')
        .upsert(
          { ...settings, updated_by: userId },
          { onConflict: 'church_id' }
        )
    )
    return this.publicSettings(settings)
  }
  private account(payment: GivingPayment | GivingSettings) {
    if (!payment.credentials_ciphertext)
      throw new GivingError('The church’s M-Pesa connection is not ready.', 409)
    return {
      ...decryptGivingCredentials(
        payment.credentials_ciphertext,
        this.options.encryptionKey
      ),
      environment: payment.environment,
      businessShortCode: payment.business_shortcode,
      destinationType: payment.destination_type,
      destinationNumber: payment.destination_number,
    }
  }
  private async paymentRow(
    id: string,
    churchId?: string
  ): Promise<GivingPayment | null> {
    let query = this.db.from('giving_payments').select('*').eq('id', id)
    if (churchId) query = query.eq('church_id', churchId)
    return checked(await query.maybeSingle()) as GivingPayment | null
  }
  private async repeatedPayment(userId: string, input: GivingInput) {
    const existing = checked(
      await this.db
        .from('giving_payments')
        .select('*')
        .eq('church_id', input.churchId)
        .eq('user_id', userId)
        .eq('request_id', input.requestId)
        .maybeSingle()
    ) as GivingPayment | null
    if (
      existing &&
      (Number(existing.amount) !== input.amount ||
        existing.phone !== input.phone ||
        existing.type !== input.type)
    )
      throw new GivingError(
        'This request already belongs to another payment. Check your giving history before starting again.',
        409
      )
    return existing
  }
  private async pendingPayment(userId: string, churchId: string) {
    return checked(
      await this.db
        .from('giving_payments')
        .select('*')
        .eq('church_id', churchId)
        .eq('user_id', userId)
        .in('status', [...PENDING_STATUSES])
        .maybeSingle()
    ) as GivingPayment | null
  }
  async getPendingPayment(userId: string, churchId: string) {
    await this.membership(userId, churchId)
    const payment = await this.pendingPayment(userId, churchId)
    return payment ? publicPayment(payment) : null
  }
  async start(userId: string, raw: GivingInput) {
    const input = validateGiving(raw)
    const member = await this.membership(userId, input.churchId)
    const existing =
      (await this.repeatedPayment(userId, input)) ??
      (await this.pendingPayment(userId, input.churchId))
    if (existing) return publicPayment(existing)
    const recent = await this.db
      .from('giving_payments')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', input.churchId)
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 60_000).toISOString())
    checked(recent)
    if ((recent.count ?? 0) >= 3)
      throw new GivingError(
        'Please wait a minute before requesting another M-Pesa prompt.',
        429
      )
    const settings = await this.settingsRow(input.churchId)
    if (!settings || !this.publicSettings(settings).ready)
      throw new GivingError(
        'STK giving is not ready for this church. Please contact the church administrator.',
        409
      )
    const account = this.account(settings)
    // Authentication fails before any pending charge is created.
    const accessToken = await this.provider.accessToken(account)
    const church = checked(
      await this.db
        .from('churches')
        .select('name, logo_url, address, phone, email')
        .eq('id', input.churchId)
        .single()
    ) as ReceiptDetails['church']
    const user = checked(
      await this.db
        .from('users')
        .select('full_name, email')
        .eq('id', userId)
        .single()
    )
    if (!user)
      throw new GivingError(
        'Your member profile is not ready for giving. Please refresh and try again.',
        409
      )
    const id = randomUUID(),
      callbackToken = createCallbackToken()
    const reference =
      settings.account_reference ||
      `GIVE${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`
    const inserted = await this.db
      .from('giving_payments')
      .insert({
        id,
        church_id: input.churchId,
        membership_id: member.id,
        user_id: userId,
        request_id: input.requestId,
        amount: input.amount,
        phone: input.phone,
        type: input.type,
        environment: settings.environment,
        destination_type: settings.destination_type,
        destination_number: settings.destination_number,
        account_reference: reference,
        business_shortcode: settings.business_shortcode,
        credentials_ciphertext: settings.credentials_ciphertext,
        callback_token_hash: callbackTokenHash(callbackToken),
        receipt_details: {
          church,
          donor: {
            full_name: member.full_name || user.full_name || 'Member',
            email: member.email || user.email,
          },
          phone: input.phone,
          destination_type: settings.destination_type,
          destination_number: settings.destination_number,
          account_reference: reference,
          environment: settings.environment,
        },
      })
      .select('*')
      .single()
    if (inserted.error?.code === '23505') {
      const concurrent =
        (await this.repeatedPayment(userId, input)) ??
        (await this.pendingPayment(userId, input.churchId))
      if (concurrent) return publicPayment(concurrent)
    }
    const payment = checked(inserted) as GivingPayment
    const updateInitiating = async (changes: Record<string, unknown>) => {
      const updated = checked(
        await this.db
          .from('giving_payments')
          .update(changes)
          .eq('id', payment.id)
          .eq('status', 'initiating')
          .select('*')
          .maybeSingle()
      ) as GivingPayment | null
      return publicPayment(updated ?? (await this.paymentRow(payment.id))!)
    }
    let checkout:
      | { checkout_request_id: string; merchant_request_id: string | null }
      | undefined
    try {
      const response = await this.provider.push(account, accessToken, {
        phone: input.phone,
        amount: input.amount,
        reference,
        callbackUrl: `${givingCallbackBase(this.options.publicUrl)}${this.options.callbackPath}?id=${id}&token=${callbackToken}`,
      })
      if (
        String(response.ResponseCode) === '0' &&
        typeof response.CheckoutRequestID === 'string' &&
        response.CheckoutRequestID.trim()
      ) {
        checkout = {
          checkout_request_id: response.CheckoutRequestID,
          merchant_request_id: response.MerchantRequestID ?? null,
        }
        return await updateInitiating({
          ...checkout,
          status: 'pending',
          error: null,
        })
      }
      if (
        (response.ResponseCode != null &&
          String(response.ResponseCode) !== '0') ||
        response.errorCode
      )
        throw new DarajaRejected(
          'M-Pesa did not accept this payment request. Please check the details and try again.'
        )
      throw new Error('Incomplete provider response')
    } catch (error) {
      return updateInitiating({
        ...checkout,
        status: error instanceof DarajaRejected ? 'failed' : 'review',
        error:
          error instanceof DarajaRejected
            ? error.message
            : 'The request was interrupted. Check its status or contact the church before making another payment.',
      })
    }
  }

  private async authorizedPayment(
    userId: string,
    churchId: string,
    id: string
  ) {
    if (!UUID_PATTERN.test(id)) throw new GivingError('Payment not found.', 404)
    const member = await this.membership(userId, churchId)
    const payment = await this.paymentRow(id, churchId)
    if (
      !payment ||
      (payment.user_id !== userId &&
        !(await this.financeAccess(churchId, member)))
    )
      throw new GivingError('Payment not found.', 404)
    return payment
  }
  async getPayment(userId: string, churchId: string, id: string) {
    return publicPayment(await this.authorizedPayment(userId, churchId, id))
  }
  private async confirm(
    payment: GivingPayment,
    receipt?: string,
    paidAt?: string
  ) {
    return checked(
      await this.db.rpc('confirm_giving_payment', {
        p_id: payment.id,
        p_checkout: payment.checkout_request_id,
        p_receipt: receipt ?? null,
        p_paid_at: paidAt ?? null,
      })
    ) as GivingPayment
  }
  private async verify(
    payment: GivingPayment,
    receipt?: string,
    paidAt?: string,
    callback = false
  ): Promise<GivingPayment> {
    if (payment.status === 'succeeded')
      return receipt ? this.confirm(payment, receipt, paidAt) : payment
    if (!payment.checkout_request_id) return payment
    if (!callback) {
      // Claim a status check atomically so browser tabs cannot flood Daraja.
      const cutoff = new Date(Date.now() - 8_000).toISOString()
      const claimed = checked(
        await this.db
          .from('giving_payments')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', payment.id)
          .neq('status', 'succeeded')
          .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
          .select('id')
          .maybeSingle()
      )
      if (!claimed) return (await this.paymentRow(payment.id)) ?? payment
    }
    const result = await this.provider.query(
      this.account(payment),
      payment.checkout_request_id
    )
    // A callback is only a notification. The authenticated query must identify
    // the exact checkout created with this church's saved credentials.
    if (
      result.CheckoutRequestID !== payment.checkout_request_id ||
      (payment.merchant_request_id &&
        result.MerchantRequestID &&
        result.MerchantRequestID !== payment.merchant_request_id) ||
      String(result.ResponseCode) !== '0'
    )
      return payment
    if (String(result.ResultCode) === '0')
      return this.confirm(payment, receipt, paidAt)
    if (result.ResultCode != null && /^\d+$/.test(String(result.ResultCode))) {
      const code = Number(result.ResultCode)
      const updated = checked(
        await this.db
          .from('giving_payments')
          .update({
            status: 'failed',
            result_code: code,
            error: paymentFailure(code),
          })
          .eq('id', payment.id)
          .neq('status', 'succeeded')
          .select('*')
          .maybeSingle()
      ) as GivingPayment | null
      return updated ?? (await this.paymentRow(payment.id)) ?? payment
    }
    return payment
  }
  async verifyPayment(userId: string, churchId: string, id: string) {
    return publicPayment(
      await this.verify(await this.authorizedPayment(userId, churchId, id))
    )
  }
  async handleCallback(id: string, token: string, body: unknown) {
    if (!UUID_PATTERN.test(id) || !/^[a-f0-9]{64}$/.test(token))
      throw new GivingError('Unauthorized callback.', 401)
    let payment = await this.paymentRow(id)
    if (!payment || !validCallbackToken(token, payment.callback_token_hash))
      throw new GivingError('Unauthorized callback.', 401)
    const callback = record(record(record(body).Body).stkCallback)
    const checkout = callback.CheckoutRequestID,
      merchant = callback.MerchantRequestID
    if (
      typeof checkout !== 'string' ||
      !checkout.trim() ||
      typeof merchant !== 'string' ||
      !merchant.trim() ||
      !/^\d+$/.test(String(callback.ResultCode))
    )
      throw new GivingError('Invalid payment callback.')
    if (
      (payment.checkout_request_id &&
        payment.checkout_request_id !== checkout) ||
      (payment.merchant_request_id && payment.merchant_request_id !== merchant)
    )
      throw new GivingError('Payment callback does not match the request.')
    let receipt: string | undefined, paidAt: string | undefined
    if (String(callback.ResultCode) === '0') {
      const metadata = record(callback.CallbackMetadata).Item
      const items = Array.isArray(metadata) ? metadata.map(record) : []
      const value = (name: string) =>
        items.find((item) => item.Name === name)?.Value
      const rawReceipt = value('MpesaReceiptNumber')
      if (
        Number(value('Amount')) !== Number(payment.amount) ||
        givingPhone(String(value('PhoneNumber'))) !== payment.phone ||
        typeof rawReceipt !== 'string' ||
        !/^[A-Z0-9]{8,20}$/.test(rawReceipt)
      )
        throw new GivingError(
          'The confirmed amount, phone or receipt does not match this payment.'
        )
      receipt = rawReceipt
      const date = String(value('TransactionDate'))
      if (/^\d{14}$/.test(date)) {
        const parsed = new Date(
          `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(8, 10)}:${date.slice(10, 12)}:${date.slice(12, 14)}+03:00`
        )
        if (Number.isFinite(parsed.getTime())) paidAt = parsed.toISOString()
      }
    }
    // Handle providers calling back before the initiation response has arrived.
    // The unguessable per-payment token binds this early callback to its row.
    if (!payment.checkout_request_id) {
      checked(
        await this.db
          .from('giving_payments')
          .update({
            checkout_request_id: checkout,
            merchant_request_id: merchant,
            status: 'pending',
          })
          .eq('id', payment.id)
          .is('checkout_request_id', null)
          .in('status', [...PENDING_STATUSES])
      )
      payment = (await this.paymentRow(payment.id))!
      if (payment.checkout_request_id !== checkout)
        throw new GivingError('Payment callback does not match the request.')
    }
    await this.verify(payment, receipt, paidAt, true)
    return { ResultCode: 0, ResultDesc: 'Accepted' }
  }
  async reconcilePending() {
    const payments = checked(
      await this.db
        .from('giving_payments')
        .select('*')
        .in('status', ['pending', 'review'])
        .not('checkout_request_id', 'is', null)
        .order('last_checked_at', { ascending: true, nullsFirst: true })
        .limit(5)
    ) as GivingPayment[]
    const results = await Promise.allSettled(
      payments.map((payment) => this.verify(payment))
    )
    return {
      checked: payments.length,
      confirmed: results.filter(
        (result) =>
          result.status === 'fulfilled' && result.value.status === 'succeeded'
      ).length,
    }
  }

  private historyFilters(filters: GivingHistoryFilters) {
    const page = filters.page ?? 1,
      pageSize = filters.pageSize ?? 25
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 1_000_000 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    )
      throw new GivingError('Invalid history page.')
    if (
      filters.type &&
      !GIVING_TYPES.includes(filters.type as (typeof GIVING_TYPES)[number])
    )
      throw new GivingError('Invalid giving type.')
    if (
      filters.status &&
      !HISTORY_STATUSES.includes(
        filters.status as (typeof HISTORY_STATUSES)[number]
      )
    )
      throw new GivingError('Invalid payment status.')
    const day = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new GivingError('Use YYYY-MM-DD for history dates.')
      const utc = new Date(`${value}T00:00:00Z`)
      if (
        !Number.isFinite(utc.getTime()) ||
        utc.toISOString().slice(0, 10) !== value
      )
        throw new GivingError('Invalid history date.')
      return new Date(`${value}T00:00:00+03:00`).getTime()
    }
    const from = filters.from ? day(filters.from) : undefined
    const to = filters.to ? day(filters.to) + 86_400_000 : undefined
    if (from !== undefined && to !== undefined && from >= to)
      throw new GivingError('The end date must be on or after the start date.')
    return { page, pageSize, from, to }
  }
  private historyQuery(
    churchId: string,
    membershipId: string | null,
    filters: GivingHistoryFilters,
    count = false,
    order = 'given_at'
  ) {
    const { from, to } = this.historyFilters(filters)
    let query = this.db
      .from('giving_history')
      .select('*', count ? { count: 'exact' } : undefined)
      .eq('church_id', churchId)
      .order(order, { ascending: false })
      .order('id', { ascending: false })
    if (membershipId) query = query.eq('membership_id', membershipId)
    if (from !== undefined)
      query = query.gte('given_at', new Date(from).toISOString())
    if (to !== undefined)
      query = query.lt('given_at', new Date(to).toISOString())
    if (filters.type) query = query.eq('type', filters.type)
    if (filters.status) query = query.eq('status', filters.status)
    return query
  }
  private async historyScope(
    userId: string,
    churchId: string,
    scope: 'mine' | 'church'
  ) {
    const member = await this.membership(userId, churchId)
    if (scope === 'church' && !(await this.financeAccess(churchId, member)))
      throw new GivingError(
        'Finance permission is required to view the church’s giving history.',
        403
      )
    return scope === 'mine' ? member.id : null
  }
  async history(
    userId: string,
    churchId: string,
    scope: 'mine' | 'church',
    filters: GivingHistoryFilters = {}
  ): Promise<GivingHistory> {
    const membershipId = await this.historyScope(userId, churchId, scope)
    const { page, pageSize } = this.historyFilters(filters)
    const result = await this.historyQuery(
      churchId,
      membershipId,
      filters,
      true
    ).range((page - 1) * pageSize, page * pageSize - 1)
    return {
      rows: checked(result) as GivingHistoryRow[],
      total: result.count ?? 0,
      page,
      pageSize,
    }
  }
  async exportHistory(
    userId: string,
    churchId: string,
    scope: 'mine' | 'church',
    filters: GivingHistoryFilters = {}
  ) {
    const membershipId = await this.historyScope(userId, churchId, scope)
    this.historyFilters(filters)
    const church = checked(
      await this.db.from('churches').select('name').eq('id', churchId).single()
    ) as { name: string }
    const before = new Date().toISOString()
    const historyQuery = () =>
      this.historyQuery(churchId, membershipId, filters, false, 'created_at')
    async function* rows() {
      let cursor: GivingHistoryRow | undefined
      while (true) {
        let query = historyQuery().lte('created_at', before).limit(500)
        if (cursor)
          query = query.or(
            `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
          )
        const batch = checked(await query) as GivingHistoryRow[]
        for (const row of batch) yield row
        if (batch.length < 500) break
        cursor = batch[batch.length - 1]
      }
    }
    return { churchName: church.name, rows: rows() }
  }
  async receipt(userId: string, churchId: string, offeringId: string) {
    if (!UUID_PATTERN.test(offeringId))
      throw new GivingError('Receipt not found.', 404)
    const member = await this.membership(userId, churchId)
    let query = this.db
      .from('offerings')
      .select(
        'id, amount, currency, type, method, status, receipt_number, reference, given_at, created_at, receipt_details'
      )
      .eq('church_id', churchId)
      .eq('id', offeringId)
    if (!(await this.financeAccess(churchId, member)))
      query = query.eq('membership_id', member.id)
    const offering = checked(await query.maybeSingle())
    if (!offering) throw new GivingError('Receipt not found.', 404)
    if (
      !['completed', 'test'].includes(offering.status) ||
      !offering.receipt_number
    )
      throw new GivingError(
        'A receipt is available only after payment is confirmed.',
        409
      )
    return {
      ...offering,
      currency: offering.currency ?? 'KES',
      given_at: offering.given_at ?? offering.created_at,
    } as {
      id: string
      amount: number
      currency: string
      type: string
      method: string
      status: string
      receipt_number: string
      reference: string | null
      given_at: string
      receipt_details: ReceiptDetails
    }
  }
}
