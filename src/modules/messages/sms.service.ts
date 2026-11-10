import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { normalizePhoneForSms } from '../../common/phone.config'
import {
  requireSmsConfig,
  sendAfricasTalking,
  type SmsProviderConfig,
} from './africas-talking'

@Injectable()
export class SmsService {
  constructor(private readonly config: ConfigService) {}
  get configuration(): SmsProviderConfig {
    return {
      username: this.config.get<string>('sms.username'),
      apiKey: this.config.get<string>('sms.apiKey'),
      senderId: this.config.get<string>('sms.senderId'),
      environment:
        this.config.get<string>('sms.env') === 'production'
          ? 'production'
          : 'sandbox',
    }
  }
  ensureConfigured() {
    requireSmsConfig(this.configuration)
  }
  send(params: { to: string[] | string; message: string; senderId?: string }) {
    return sendAfricasTalking(
      {
        ...this.configuration,
        senderId: params.senderId ?? this.configuration.senderId,
      },
      Array.isArray(params.to) ? params.to : [params.to],
      params.message
    )
  }
  normalizePhone(phone: string) {
    return normalizePhoneForSms(phone)
  }
}
