'use client'

/**
 * Sincroniza o Open Finance quando o app abre (PRD P53, decidido em
 * 2026-09-29). O servidor é quem aplica o intervalo mínimo de seis horas, então
 * montar isto em toda navegação custa uma requisição que responde "Skipped".
 *
 * Silencioso de propósito: sem credenciais (`open_finance.not_configured`) ou
 * com o provedor fora do ar, o app segue com o último retrato, e o card
 * "Open Finance" das telas de cadastro é onde o erro aparece com explicação.
 */

import * as React from 'react'
import { useSyncOpenFinance } from './use-open-finance'

export function OpenFinanceAutoSync() {
  const sync = useSyncOpenFinance()
  const started = React.useRef(false)

  React.useEffect(() => {
    if (started.current) return
    started.current = true
    sync.mutate(false)
  }, [sync])

  return null
}
