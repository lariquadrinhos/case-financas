'use client'

import * as React from 'react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/patterns/money-input'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { LABEL_CLASSIFICATION, type Classification, type Entity } from '@/domain/core/vocabulary'
import { cents, type Cents } from '@/domain/core'
import { ClassificationFieldHelp } from '@/components/patterns/field-help'
import { ApiError } from '@/lib/api-client'
import { liabilities } from '@/features/plano-de-contas-e-patrimonio/liabilities'
import { formatMonthlyRate } from '@/domain/assets/installments'
import type { Liability } from '../_lib/queries'

const ENTITY_OPTIONS = [
  { value: 'PF' as const, label: 'PF' },
  { value: 'PJ' as const, label: 'PJ' },
]

const CLASSIFICATION_OPTIONS = [
  { value: 'Current' as const, label: LABEL_CLASSIFICATION.Current },
  { value: 'NonCurrent' as const, label: LABEL_CLASSIFICATION.NonCurrent },
]

interface FormState {
  name: string
  creditor: string
  entity: Entity
  classification: Classification
  installmentAmount: Cents
}

function formFrom(liability: Liability): FormState {
  return {
    name: liability.name,
    creditor: liability.creditor,
    entity: liability.entity,
    classification: liability.classification,
    installmentAmount: cents(liability.installmentAmount),
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível salvar. Tente novamente.'
}

/**
 * "Editar dados cadastrais" — files_design/01 §12, o botão `91:43` do grupo
 * `203:2` no Wireframe `91:2` (Mockup `948:1687`, instance `948:1839`).
 *
 * DADOS CADASTRAIS, não a forma do cronograma. Os cinco campos que alimentam
 * `buildInstallmentSchedule` — Valor original da dívida, Número de parcelas,
 * Parcelas já pagas, Data de início e Taxa de juros — não estão aqui, e o
 * `PATCH` os recusa com 422 (`@/api/contracts/liabilities`,
 * `liabilityPatchSchema`): a legenda `91:98` do gráfico (Mockup `949:72`)
 * nomeia UM gatilho de recálculo, "Recalculado a cada reajuste de juros
 * registrado", que é a outra ação do mesmo cabeçalho (`91:58` → `94:2`). Com
 * eles aqui, mudar "Número de parcelas" de 360 pra 400 fazia o card
 * "Parcelas" (`91:56`) imprimir "12 / 400 pagas" sobre uma lista (`337:3`) de
 * 360 linhas e um rodapé (`91:132`) que continuava contando sobre 360.
 *
 * "Valor da parcela" continua editável: é cadastro declarado e não entra na
 * conta (ver `buildInstallmentSchedule`).
 */
export function EditLiabilityDialog({
  open,
  onOpenChange,
  liability,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  liability: Liability
}) {
  const [form, setForm] = React.useState<FormState>(() => formFrom(liability))
  const [error, setError] = React.useState<string | undefined>(undefined)
  const patch = liabilities.usePatch()

  React.useEffect(() => {
    if (open) {
      setForm(formFrom(liability))
      setError(undefined)
    }
  }, [open, liability])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    const creditor = form.creditor.trim()

    if (name === '' || creditor === '') {
      setError('Preencha nome e credor/instituição.')
      return
    }
    setError(undefined)

    patch.mutate(
      {
        id: liability.id,
        body: {
          name,
          creditor,
          entity: form.entity,
          classification: form.classification,
          installmentAmount: form.installmentAmount,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 460 de largura, o diálogo-formulário: era `wide`, que valia 720 — largura que
          nenhum frame desenha. 460 é a medida que 94:39/994:2372 e 99:39/991:2204
          dão a todo diálogo de formulário, e desde 2026-09-11 também a deste:
          `Desktop — Editar Dados Cadastrais (claro)` (`1425:6172`, diálogo
          `1425:6318`) e `(escuro)` (`1425:6373`), sobre o Detalhe do Passivo. */}
      <DialogContent width="form">
        <DialogHeader>
          <DialogTitle>Editar dados cadastrais</DialogTitle>
          <DialogDescription>{liability.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="grid grid-cols-3 gap-16">
              <Field label="Nome">
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Ex: Financiamento apartamento"
                  />
                )}
              </Field>
              <Field label="Credor / Instituição">
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={form.creditor}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, creditor: event.target.value }))
                    }
                    placeholder="Ex: Caixa Econômica"
                  />
                )}
              </Field>
              <Field label="Entidade" required={false} className="w-fit">
                {(fieldProps) => (
                  <SegmentedControl
                    {...fieldProps}
                    options={ENTITY_OPTIONS}
                    value={form.entity}
                    onValueChange={(entity) => setForm((prev) => ({ ...prev, entity }))}
                  />
                )}
              </Field>
            </div>
            {/* Esta linha NÃO é `grid-cols-3` como a de cima, e a razão é
                aritmética: o corpo do diálogo `form` tem 412 úteis (460 − 24 −
                24 de `px-24`), e três colunas com `gap-16` dão 126,67 a cada
                uma. "R$ 999.000.000.000,00" mede 154 de texto (medido no navegador)
                e precisa de 180 com o respiro de 12+12 e a borda — 126 cortava
                o número pela metade. Aqui o
                campo leva os 180 de `--width-field-money-dialog` e o bloco da
                taxa fica com os 216 restantes. */}
            <div className="flex gap-16">
              <Field
                label="Valor da parcela"
                className="w-[var(--width-field-money-dialog)] shrink-0"
              >
                {(fieldProps) => (
                  <MoneyInput
                    {...fieldProps}
                    value={form.installmentAmount}
                    onValueChange={(installmentAmount) =>
                      setForm((prev) => ({ ...prev, installmentAmount }))
                    }
                  />
                )}
              </Field>
              <div className="flex flex-col gap-4">
                <span className="text-style-label-xs text-ink-tertiary">Taxa de juros (a.m.)</span>
                {/* `formatMonthlyRate` e não `formatPercentText`: o segundo é o
                    formato de DIGITAÇÃO (alimenta `monthlyInterestRateText` nos
                    formulários) e não carrega o "%". Visto no navegador com a
                    taxa em 0,05: imprimia "5" sob o rótulo "TAXA DE JUROS
                    (A.M.)". Sem " a.m." no fim, porque o rótulo já diz. */}
                <p className="text-style-body-md text-ink-primary">
                  {formatMonthlyRate(liability.monthlyInterestRate)}
                </p>
                {/* files_design/02: mudar a taxa é sempre pela causa raiz —
                    "Registrar reajuste de juros" recalcula o cronograma
                    (Wireframe `91:2` nó `91:98`); este formulário nunca edita a
                    taxa diretamente. Vale igual pros outros quatro campos do
                    cronograma, que por isso não aparecem neste diálogo. */}
                <p className="text-style-body-sm text-ink-secondary">
                  Pra mudar, use &quot;Registrar reajuste de juros&quot;.
                </p>
              </div>
            </div>
            <Field
              label="Classificação (sugerida)"
              required={false}
              help="Sugerida a partir do nome — pode ser ajustada."
              labelExtra={<ClassificationFieldHelp />}
            >
              {(fieldProps) => (
                <SegmentedControl
                  {...fieldProps}
                  options={CLASSIFICATION_OPTIONS}
                  value={form.classification}
                  onValueChange={(classification) =>
                    setForm((prev) => ({ ...prev, classification }))
                  }
                />
              )}
            </Field>
            {(error ?? patch.isError) ? (
              <p role="alert" className="text-style-body-sm text-ink-negative">
                {error ?? errorMessage(patch.error)}
              </p>
            ) : null}
            <RequiredFieldLegend />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={patch.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
