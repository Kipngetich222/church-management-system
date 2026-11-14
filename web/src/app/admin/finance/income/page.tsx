import { FinanceRegisterPage } from '@/components/finance/FinanceRegisterPage'
export default function IncomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return <FinanceRegisterPage {...props} kind="income" />
}
