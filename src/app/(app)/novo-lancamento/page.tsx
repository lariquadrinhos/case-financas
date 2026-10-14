import { Suspense } from 'react'
import { Loading } from '@/components/patterns/loading'
import { NovoLancamentoScreen } from './novo-lancamento-screen'

/**
 * Novo Lançamento — files_design/01 §5: "tela de maior prioridade do
 * produto". `useSearchParams` (read inside `NovoLancamentoScreen`, for
 * `?from=` and `?entryId=`) requires a Suspense boundary in the App Router, so
 * it lives here rather than forcing the whole route out of static analysis.
 */
export default function NovoLancamentoPage() {
  return (
    <Suspense fallback={<Loading label="Carregando Novo Lançamento" />}>
      <NovoLancamentoScreen />
    </Suspense>
  )
}
