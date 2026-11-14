import { HttpException, Injectable } from '@nestjs/common'
import { SupabaseService } from '../../supabase/supabase.service'
import { FinanceEngine } from './finance-engine'
import { FinanceError } from './finance.types'

@Injectable()
export class FinanceService {
  readonly engine: FinanceEngine
  constructor(supabase: SupabaseService) {
    this.engine = new FinanceEngine(supabase.admin)
  }
  async run<T>(action: (engine: FinanceEngine) => Promise<T>): Promise<T> {
    try {
      return await action(this.engine)
    } catch (error) {
      if (error instanceof FinanceError)
        throw new HttpException(error.message, error.status)
      throw error
    }
  }
}
