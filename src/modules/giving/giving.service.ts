import { HttpException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../../supabase/supabase.service'
import { GivingEngine } from './giving-engine'
import { GivingError } from './giving.types'

@Injectable()
export class GivingService {
  readonly engine: GivingEngine
  constructor(supabase: SupabaseService, config: ConfigService) {
    this.engine = new GivingEngine(supabase.admin, {
      publicUrl: config.get<string>('apiPublicUrl') ?? '',
      callbackPath: '/api/v1/giving/mpesa/callback',
      encryptionKey: config.get<string>('GIVING_CREDENTIALS_KEY'),
    })
  }
  async run<T>(action: (engine: GivingEngine) => Promise<T>): Promise<T> {
    try {
      return await action(this.engine)
    } catch (error) {
      if (error instanceof GivingError)
        throw new HttpException(error.message, error.status)
      throw error
    }
  }
}
