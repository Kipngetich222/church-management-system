import { FinanceRegisterPage } from '@/components/finance/FinanceRegisterPage'
export default function TransactionsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return <FinanceRegisterPage {...props} />
}
