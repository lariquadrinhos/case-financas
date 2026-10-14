'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { MoneyInput } from '@/components/patterns/money-input'
import { ZERO, type Cents, type Month, type IsoDate } from '@/domain/core'
import { currentIsoDate } from '@/lib/format'
import { useAddDiscretionaryExpense } from '../../_lib/mutations'

/**
 * "Gastei um valor" — popover sobre Início, docs/figma/frames/
 * 345-1002__desktop-gastei-um-valor-modal-sobre-inicio.xml, node 345:1252.
 *
 * Only the amount: files_design/01 §4a — "sem categoria, sem conta, sem
 * data pra escolher, só o valor. A barra atualiza na hora." Rendered as the
 * same Dialog composition every "modal sobre Início" uses (scrim + card,
 * files_design/07 processo #10) — the design calls it a "popover" in prose,
 * but the frame itself is centered over a darkened Início, identical to the
 * other five.
 */
export function DiscretionaryExpenseModal({
  open,
  onOpenChange,
  month,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  month: Month
}) {
  const [amount, setAmount] = React.useState<Cents>(ZERO)
  const addExpense = useAddDiscretionaryExpense(month)

  React.useEffect(() => {
    if (open) setAmount(ZERO)
  }, [open])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (amount <= 0) return
    addExpense.mutate(
      { amount, date: currentIsoDate() as IsoDate },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 320 de largura: frame 345:1252 (Wireframe) e nó "Diálogo" 1000:2643 (Mockup).
          Era `--width-popover`, token de outra família com o mesmo valor. */}
      <DialogContent width="prompt" aria-describedby="gastei-um-valor-legenda">
        <DialogHeader>
          <DialogTitle>Quanto você gastou?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
            {/* O rótulo "Valor *" é VISÍVEL, e isso mudou em 2026-09-11.

                O comentário anterior dizia que "o frame 345:1254 NÃO desenha
                rótulo visível" — e estava certo sobre o WIREFRAME, que traz só
                a caixa com "R$ 0,00". Mas a camada visual acrescentou o rótulo:
                o Mockup desenha uma instância `Campo` com o texto "Valor *"
                acima da caixa. Pela precedência da ADR-0015 quem vale é a
                Mockup, e o código estava seguindo a camada anterior — a mesma
                classe de defeito que a P41 corrigiu no DRE.

                A armadilha que o comentário registrava continua real e por isso
                fica escrita: envolver o campo num `<Field className="sr-only">`
                esconde o INPUT junto com o rótulo, porque `sr-only` recorta o
                elemento e tudo dentro dele. A saída é o `<Field>` normal, com o
                rótulo visível — que é o que a Mockup pede. */}
            <Field label="Valor">
              {({ id, ...aria }) => (
                <MoneyInput autoFocus id={id} value={amount} onValueChange={setAmount} {...aria} />
              )}
            </Field>
            <Button type="submit" width="full" disabled={amount <= 0 || addExpense.isPending}>
              Confirmar
            </Button>
            {/* A legenda vem DEPOIS do botão, não sob o título: Wireframe
                345:1252 desenha 345:1253 (título, y=20), 345:1254 (campo,
                y=50), 345:1256 ("Confirmar", y=102) e só então 345:1258
                (legenda, y=150); o Mockup 1000:2643 repete a mesma ordem em
                y=24 / 70 / 150 / 210. Ela continua sendo o
                `aria-describedby` do diálogo — mudou de lugar, não de papel —,
                e por isso é `DialogDescription` fora do `DialogHeader`, no fim
                do form, onde o `gap-16` reproduz os 16 que separam 1000:2649
                de 1000:2651. */}
            <DialogDescription id="gastei-um-valor-legenda">
              Sem categoria, sem conta, sem data pra escolher, só o valor. A barra atualiza na hora.
            </DialogDescription>
            {/* files_design/03: a legenda aparece uma vez por tela ou diálogo
                que tenha campo obrigatório, no fim. Faltava aqui — e sem o
                rótulo visível acima ela nem teria asterisco a explicar. */}
            <RequiredFieldLegend />
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
