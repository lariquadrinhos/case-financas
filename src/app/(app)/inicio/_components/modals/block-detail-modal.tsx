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
import { SearchCreateField, type SearchCreateItem } from '@/components/patterns/search-create-field'
import { Badge } from '@/components/ui/badge'
import { formatMoney, ZERO, type Cents, type Entity } from '@/domain/core'
import { useBankAccounts, useInvestments, useLiabilities } from '../../_lib/queries'
import { currentIsoDate } from '@/lib/format'
import { useTransfer } from '../../_lib/mutations'
import { ModalBackLink } from './modal-back-link'

/**
 * One line of a block's "Composição" — always at least one. More than one
 * only happens for the aggregated Investimentos block (files_design/01 §13:
 * "mostra a composição do valor, ex.: Investimentos = Tesouro Direto + Ações
 * XP"; docs/figma/frames/345-252, nó 189:23, desenha exatamente essas duas
 * linhas).
 */
export interface MoneyBlockCompositionItem {
  readonly id: string
  readonly name: string
  readonly value: Cents
  /** A etiqueta PF/PJ desenhada SOB o nome (nós 189:35 e 189:40). */
  readonly entity: Entity
}

/** One block of "Onde Está Meu Dinheiro" — a single Conta Bancária, Passivo,
 * or the aggregated Investimentos block (one or more Investimento). */
export interface MoneyBlockSelection {
  readonly id: string
  readonly name: string
  readonly value: Cents
  readonly kind: 'BankAccount' | 'Investment' | 'Liability'
  readonly items: readonly MoneyBlockCompositionItem[]
}

/**
 * Detalhe do Bloco — modal sobre Início, docs/figma/frames/
 * 345-252__desktop-detalhe-do-bloco-modal-sobre-inicio.xml, node 189:23.
 *
 * Opened by clicking a block in "Onde Está Meu Dinheiro" (files_design/01
 * §13). A Passivo block is read-only here: "Redirecionar valor" moves money
 * OUT of a block the pessoa owns into another one, and a dívida is not money
 * she has to move — extra amortisation is its own action ("Vender Bem
 * Material" §11 / Registrar Reajuste de Juros), not this generic redirect.
 */
export function BlockDetailModal({
  block,
  open,
  onOpenChange,
}: {
  block: MoneyBlockSelection | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 480 de largura: frame 189:23 (Wireframe), o contêiner do modal em 345:252. */}
      <DialogContent width="narrow">
        {block ? <BlockDetailBody block={block} onOpenChange={onOpenChange} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function BlockDetailBody({
  block,
  onOpenChange,
}: {
  block: MoneyBlockSelection
  onOpenChange: (open: boolean) => void
}) {
  const bankAccounts = useBankAccounts()
  const investments = useInvestments()
  const liabilities = useLiabilities()
  const transfer = useTransfer()

  const [query, setQuery] = React.useState('')
  const [destination, setDestination] = React.useState<SearchCreateItem | null>(null)
  const [value, setValue] = React.useState<Cents>(ZERO)
  const [error, setError] = React.useState<string | null>(null)

  // Os três tipos de bloco do mapa, na ordem em que o placeholder 189:48 os
  // nomeia ("Buscar conta, investimento ou dívida…"): Conta, Investimento e
  // Dívida. A nota 189:55 (Wireframe) e 1002:3146 (Mockup) repetem a mesma
  // lista — "qualquer outro bloco do mapa (Contas, Dívidas, outro
  // Investimento)" —, e files_design/01 §13 também.
  //
  // Uma versão anterior montava a lista só com Contas + Investimentos,
  // alegando em comentário que Dívida não entra por falta de escrita de saldo
  // devedor. Medido: com um Passivo cadastrado, a busca respondia "Nenhum
  // resultado encontrado." enquanto o placeholder copiado do frame prometia
  // "dívida" — a tela prometia um destino que ela nunca ofereceria. O gap de
  // escrita é real e continua registrado, mas ele mora no submit
  // (`handleRedirect`), onde vira uma recusa explícita, e não na busca.
  //
  // O filtro exclui os instrumentos do PRÓPRIO bloco, não o `block.id`: no
  // bloco agregado Investimentos o id é sintético ('investimentos', ver
  // money-map-card.tsx), então filtrar por ele deixaria Tesouro Direto e Ações
  // XP aparecerem como destino de si mesmos.
  const sourceIds = React.useMemo(
    () => new Set<string>([block.id, ...block.items.map((item) => item.id)]),
    [block.id, block.items],
  )

  const destinationItems: readonly (SearchCreateItem & {
    kind: 'BankAccount' | 'Investment' | 'Liability'
  })[] = React.useMemo(() => {
    const accounts = (bankAccounts.data?.data ?? [])
      .filter((account) => !sourceIds.has(account.id))
      .map((account) => ({ id: account.id, label: account.label, kind: 'BankAccount' as const }))
    const invs = (investments.data?.data ?? [])
      .filter((investment) => !sourceIds.has(investment.id))
      .map((investment) => ({
        id: investment.id,
        label: investment.name,
        kind: 'Investment' as const,
      }))
    const debts = (liabilities.data?.data ?? [])
      .filter((liability) => !sourceIds.has(liability.id))
      .map((liability) => ({ id: liability.id, label: liability.name, kind: 'Liability' as const }))
    const term = query.trim().toLowerCase()
    const all = [...accounts, ...invs, ...debts]
    return term === '' ? all : all.filter((item) => item.label.toLowerCase().includes(term))
  }, [bankAccounts.data, investments.data, liabilities.data, sourceIds, query])

  const isSaving = transfer.isPending

  // O bloco agregado NÃO esconde o formulário: o nó 189:23 se chama "Conceito
  // — Detalhe do Bloco (clique em Investimentos)" e é o ÚNICO estado que o
  // Wireframe desenha desta tela — duas linhas de Composição (189:32 "Tesouro
  // Direto" + 189:37 "Ações XP") e, logo abaixo, o bloco 189:42 "Redirecionar
  // valor" inteiro. Uma versão anterior condicionava o formulário a
  // `block.items.length <= 1` citando 189:23 como justificativa para
  // escondê-lo; medido no XML do frame, 189:23 é justamente quem o desenha, e
  // com o `<= 1` o clique em "Investimentos" perdia os sete elementos
  // desenhados (título, "Para onde *", "Valor *", botão, legenda e nota).
  //
  // Passivo continua fora: "Redirecionar valor" tira dinheiro de um bloco que
  // a pessoa tem, e dívida não é dinheiro que ela move (amortização extra é
  // ação própria, files_design/01 §11).
  const canRedirect = block.kind !== 'Liability'

  /**
   * De ONDE sai o dinheiro num bloco agregado. O frame 189:23 não desenha
   * seletor de origem — só "Para onde *" e "Valor *" —, então a origem tem de
   * sair da própria Composição, e `block.id` não serve: no bloco agregado ele
   * é o id sintético 'investimentos', que não corresponde a investimento
   * nenhum (antes desta correção era ele que ia para `adjust`).
   *
   * SUPOSIÇÃO, não regra escrita: debita na ordem em que a Composição aparece
   * na tela, cada instrumento até o próprio saldo. Ordem e não rateio
   * proporcional porque é o que a pessoa consegue conferir olhando a lista que
   * acabou de ler. Se o PRD decidir rateio, muda só esta função.
   */
  function debitPlan(total: Cents): readonly { id: string; amount: Cents }[] | null {
    let remaining = total as number
    const plan: { id: string; amount: Cents }[] = []
    for (const item of block.items) {
      if (remaining <= 0) break
      const amount = Math.min(item.value, remaining)
      if (amount > 0) {
        plan.push({ id: item.id, amount: amount as Cents })
        remaining -= amount
      }
    }
    return remaining > 0 ? null : plan
  }

  /** O formato que `POST /api/v1/transfers` espera (src/api/contracts/transfers.ts). */
  function positionOf(kind: 'BankAccount' | 'Investment', id: string) {
    return kind === 'BankAccount'
      ? ({ kind: 'BankAccount', bankAccountId: id } as const)
      : ({ kind: 'Investment', investmentId: id } as const)
  }

  async function handleRedirect(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!destination || value <= 0) return
    if (block.kind === 'Liability') return
    const originKind = block.kind
    const plan = debitPlan(value)
    if (plan === null) {
      setError('O bloco não tem esse valor pra redirecionar.')
      return
    }
    const destinationKind =
      destinationItems.find((item) => item.id === destination.id)?.kind ?? 'BankAccount'
    // A recusa vem ANTES de qualquer escrita: as duas pernas do movimento são
    // requisições separadas (ver abaixo), então descobrir o destino inválido
    // depois de debitar a origem deixaria o dinheiro em lugar nenhum.
    //
    // O gap é de backend, não de desenho: abater dívida não é um PATCH de
    // saldo — o saldo devedor é derivado do cronograma de amortização, e as
    // únicas escritas que existem hoje são `POST /installments/{id}/payment`
    // (uma parcela específica) e o reajuste de juros. Redirecionar um valor
    // livre para uma dívida é amortização extraordinária, decisão de produto
    // ainda não tomada — enquanto ela não existe, a tela recusa dizendo por
    // quê, em vez de esconder o destino que o frame promete.
    if (destinationKind === 'Liability') {
      setError(
        'Redirecionar para uma dívida ainda não está disponível: abata a dívida por "Marcar Paga" na parcela, no Detalhe do Passivo.',
      )
      return
    }
    try {
      // UMA requisição, e é o ponto inteiro da ADR-0017 §2. Antes daqui isto
      // era um laço de `PATCH`, um por lado do movimento, com o defeito
      // escrito no próprio comentário: "se uma falhar as anteriores já
      // aconteceram". Com N instrumentos num bloco agregado, uma falha no meio
      // do laço debitava parte do dinheiro e não creditava nada — os valores
      // deixavam de existir, sem aviso e sem rastro.
      //
      // `POST /api/v1/transfers` debita e credita dentro de um
      // `withTransaction` (ADR-0014): ou tudo, ou nada.
      await transfer.mutateAsync({
        date: currentIsoDate(),
        sources: plan.map((step) => ({
          position: positionOf(originKind, step.id),
          amount: step.amount,
        })),
        destination: positionOf(destinationKind, destination.id),
        amount: value,
      })
      onOpenChange(false)
    } catch {
      setError('Não foi possível redirecionar agora. Tente de novo.')
    }
  }

  return (
    <>
      <DialogHeader className="gap-16">
        {/* O diálogo abre direto no link de volta, sem nó de título — medido
            no Wireframe 189:23 (primeiro filho é `189:24` "← Onde Está Meu
            Dinheiro" em x=28 y=28) e no Mockup 1002:3118 (primeiro filho é
            `1022:3025` "Link"). O diálogo precisa de um nome mesmo assim,
            senão o leitor de tela anuncia só "diálogo" — daí o título
            existir, invisível. O texto é o nome que o Figma dá ao frame —
            "Detalhe do Bloco" (345:252 no Wireframe, 1002:2884 no Mockup) — e
            só ele: o bloco clicado é anunciado pela DialogDescription. */}
        <DialogTitle className="sr-only">Detalhe do Bloco</DialogTitle>
        <ModalBackLink label="Onde Está Meu Dinheiro" />
        <div className="h-[var(--stroke-hairline)] bg-line-default" />
      </DialogHeader>
      <DialogBody>
        <DialogDescription className="sr-only">
          Composição de {block.name} e formulário pra redirecionar o valor.
        </DialogDescription>

        <section className="flex flex-col gap-4">
          <h3 className="text-style-label-xs text-ink-secondary">Composição</h3>
          {block.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-16 border-b border-line-default py-12"
            >
              <div className="flex flex-col gap-4">
                <span className="text-style-body-md text-ink-primary">{item.name}</span>
                {/* 189:35 e 189:40 desenham "PF" logo abaixo do nome do
                    instrumento — a etiqueta de entidade, mesma do DRE
                    (src/app/(app)/dre/page.tsx). Antes ficava aqui um Badge
                    "Dívida", que nenhum frame desenha, e a entidade do item
                    nunca aparecia. */}
                <Badge tone={item.entity === 'PF' ? 'pf' : 'pj'}>{item.entity}</Badge>
              </div>
              <span className="numeric text-style-body-md text-ink-primary">
                {formatMoney(item.value)}
              </span>
            </div>
          ))}
        </section>

        {canRedirect ? (
          <form className="flex flex-col gap-16" onSubmit={handleRedirect}>
            <h3 className="text-style-label-xs text-ink-secondary">Redirecionar valor</h3>
            <div className="flex flex-col gap-16">
              <Field label="Para onde">
                {({ id, ...aria }) => (
                  <SearchCreateField
                    id={id}
                    {...aria}
                    items={destinationItems}
                    query={destination?.label ?? query}
                    onQueryChange={(next) => {
                      setQuery(next)
                      setDestination(null)
                    }}
                    onSelect={(item) => {
                      setDestination(item)
                      setQuery(item.label)
                    }}
                    placeholder="Buscar conta, investimento ou dívida…"
                  />
                )}
              </Field>
              {/* 180: o mínimo para "R$ 999.000.000.000,00" (148 de texto + 12 + 12
                  de respiro) com 8 de folga. Ver `--width-field-money-dialog`. */}
              <Field label="Valor" className="w-[var(--width-field-money-dialog)]">
                {({ id, ...aria }) => (
                  <MoneyInput id={id} value={value} onValueChange={setValue} {...aria} />
                )}
              </Field>
            </div>
            {error ? (
              <p role="alert" className="text-style-body-sm text-ink-negative">
                {error}
              </p>
            ) : null}
            <Button type="submit" width="full" disabled={!destination || value <= 0 || isSaving}>
              Redirecionar
            </Button>
          </form>
        ) : null}

        {canRedirect ? (
          <>
            <RequiredFieldLegend />
            {/* Texto literal do nó 189:55, palavra por palavra. Estava
                reescrito ("qualquer outra conta ou investimento cadastrado:
                mesma busca de sempre"), o que apagava Dívidas e o "criar" do
                desenho — ver o gap registrado em `destinationItems`. */}
            <p className="text-style-body-sm text-ink-secondary">
              &quot;Para onde&quot; aceita qualquer outro bloco do mapa (Contas, Dívidas, outro
              Investimento): mesma busca/criar de sempre.
            </p>
          </>
        ) : null}
      </DialogBody>
    </>
  )
}
