'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * "Descartar" numa linha de item (Contas Bancárias, Bens Materiais,
 * Investimentos, Passivos) abre a MESMA confirmação que a Revisão de
 * Recorrentes — Figma `34:2` › `34:31` ("③ Descartar") › painel `34:34`:
 *
 *   34:35  título-pergunta  `Descartar "Academia" deste mês?`
 *   34:36  consequência     "A série continua normalmente a partir do mês seguinte."
 *   34:37  linha de botões  34:38 "Cancelar" (x=0) e 34:40 "Descartar" (x=92)
 *
 * O que existia aqui era um segundo estado do próprio botão (`useState`
 * revelando "Confirmar"/"Cancelar" soltos na linha), justificado por "no source
 * describes a dedicated confirmation dialog for it". A alegação era falsa: o
 * `34:34` é o ÚNICO painel de confirmação desenhado no produto inteiro (grep de
 * "Descartar" nos 130 XML de docs/figma/frames: em todos os outros 13 frames a
 * palavra é só rótulo de botão de linha), e files_design/02-log-de-decisoes-de-ux.md
 * :91 manda as linhas de item usarem "o mesmo estilo visual já usado na Revisão
 * de Recorrentes". Aquele desenho também violava a Style guide `521:463`
 * ("QUANDO NÃO USAR ... Texto pra ação destrutiva/irreversível") e invertia a
 * ordem 34:38 → 34:40, pondo a ação destrutiva antes de "Cancelar".
 *
 * O botão de disparo continua `text`: é ação de linha dentro de lista densa
 * (files_design/02 :1275, "dois botões — Descartar (texto) e Analisar
 * (secundário)"). O par da confirmação é `secondary` + `primary`, como
 * `521:457` define ("'Cancelar' ao lado de 'Confirmar'") e o
 * discard-this-month-dialog.tsx já fazia para o mesmo `34:34`.
 *
 * `consequence` (34:36) continua OPCIONAL na assinatura, mas os quatro usos a
 * passam: nenhuma página do Figma escreve a frase para conta bancária, bem
 * material, investimento ou passivo, então ela foi DECIDIDA com a pessoa
 * desenvolvedora em 2026-09-11, uma por tela, a partir do que o descarte
 * realmente faz — não redigida por conta própria.
 *
 * A regra que saiu: **a frase nomeia o que bloqueia aquela tela** — e, onde não
 * há bloqueio possível, diz o que o descarte TIRA. A versão genérica anterior
 * ("não funciona se algum lançamento ainda apontar") mandava procurar a coisa
 * errada em três das quatro telas.
 *
 * Só DUAS das quatro podem ser recusadas, e isso foi medido nas FKs de
 * schema.ts:
 *
 *   Conta Bancária  presa por quatro coisas, não uma — `entries`,
 *                   `recurrences`, `discretionary_spending_config` e
 *                   `allocation_items`. `bank-accounts.repository.test.ts`
 *                   derruba o descarte usando SÓ o Consumo Livre.
 *   Investimento    presa por `allocation_items`, um Direcionamento; nenhum
 *                   lançamento aponta para um investimento.
 *   Bem Material    NUNCA recusado: a única FK vem de `pending_allocations`,
 *                   que só nasce na venda, e a venda grava `soldOn` — a lista
 *                   lê `listUnsold`, então bem com Pendência não chega a
 *                   mostrar este botão.
 *   Passivo         NUNCA recusado: `liabilities.repository.ts` apaga
 *                   reajustes, parcelas e eventos na mesma transação antes da
 *                   dívida.
 *
 * Por isso Bem Material e Passivo falam do que LEVA junto, e só os outros dois
 * recebem `blockedMessage`.
 *
 * Desenhado na Mockup em 2026-09-11, sobre Contas Bancárias: `Desktop —
 * Descartar item (claro)` (`1420:6008`, diálogo `1420:6090`) e `(escuro)`
 * (`1420:6113`). O frame é UM para os quatro usos porque o diálogo é o mesmo;
 * o que muda entre eles é o `itemName` e a frase de consequência.
 */
export function ConfirmActionButton({
  label,
  itemName,
  confirmLabel = 'Descartar',
  consequence,
  blockedMessage,
  onConfirm,
  pending = false,
  className,
  size = 'compact',
  children,
}: {
  label: string
  /** O nome do item, interpolado no molde do 34:35: `Descartar "{itemName}"?`. */
  itemName: string
  confirmLabel?: string
  /** A linha 34:36. Só passe se a fonte de design escrever a frase. */
  consequence?: string
  /**
   * O que a pessoa lê quando o descarte é RECUSADO — o caso `*.in_use`, a FK
   * RESTRICT de schema.ts traduzida em 409 (ADR-0012 §2).
   *
   * Vem por prop porque o corpo do 409 não serve de mensagem: `handler.ts`
   * devolve sempre o mesmo `detail` genérico ("A operação não pôde ser
   * concluída."), de propósito — o problema+json é logado e não carrega dado
   * da pessoa. Quem sabe O QUE bloqueia é a tela, não a borda HTTP.
   */
  blockedMessage?: string
  onConfirm: () => void | Promise<unknown>
  pending?: boolean
  className?: string
  /**
   * `compact` numa linha de tabela; `default` num rodapé, ao lado de botões
   * de 44 (Novo Lançamento). Ver o comentário de `size` em button.tsx.
   */
  size?: 'compact' | 'default'
  /**
   * Uma escolha a mais, entre a consequência e os botões — hoje só o
   * "Encerrar a recorrência também" do Descartar lançamento (2026-09-23).
   */
  children?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [running, setRunning] = React.useState(false)

  // Antes disto o diálogo fechava no clique, sem esperar, e a recusa sumia: as
  // quatro telas de Patrimônio nunca renderizaram `remove.error`, então um 409
  // deixava a linha na tabela sem uma palavra de explicação.
  async function handleConfirm() {
    setFailed(false)
    setRunning(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch {
      setFailed(true)
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      {/* Destrutivo: contorno do Secundário com o texto em `ink-negative`
          (pedido do dono, 2026-10-01 — como texto puro não parecia botão). */}
      <Button
        variant="secondary"
        size={size}
        className={cn('text-ink-negative', className)}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setFailed(false)
        }}
      >
        {/* Mesma largura do outro uso do 34:34 (discard-this-month-dialog.tsx):
            o `34:2` é esquema em escala reduzida — colunas de 400 com 360
            internos — e não geometria de diálogo. Sem a linha 34:36 não há
            descrição, e o `aria-describedby` do Radix apontaria para um nó
            inexistente; por isso o atributo é anulado nesse caso. */}
        <DialogContent
          width="form"
          {...(consequence === undefined ? { 'aria-describedby': undefined } : {})}
        >
          <DialogHeader>
            <DialogTitle>Descartar &quot;{itemName}&quot;?</DialogTitle>
            {consequence === undefined ? null : (
              <DialogDescription>{consequence}</DialogDescription>
            )}
          </DialogHeader>
          {children !== undefined ? <DialogBody>{children}</DialogBody> : null}
          {failed ? (
            <DialogBody>
              <p role="alert" className="text-style-body-sm text-ink-negative">
                {blockedMessage ?? 'Não foi possível descartar. Tente de novo.'}
              </p>
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={pending || running}
              onClick={() => void handleConfirm()}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
