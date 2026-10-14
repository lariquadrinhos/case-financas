'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmActionButton } from '@/components/patterns/confirm-action-button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Empty } from '@/components/patterns/empty'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { ErrorState } from '@/components/patterns/error-state'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { LABEL_CLASSIFICATION } from '@/domain/core/vocabulary'
import { cents, formatMoney, formatPercent } from '@/domain/core'
import { liabilities } from '../liabilities'
import { LiabilityForm } from '../liability-form'
import type { Liability } from '../types'

export function PassivosScreen() {
  const list = liabilities.useList()

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-16">
        <h1 className="text-style-heading-xl text-ink-primary">Passivos</h1>
        {/* Figma 90:6, word for word. */}
        <p className="max-w-[var(--width-content-max)] text-style-body-sm text-ink-secondary">
          Passivos: dívidas e financiamentos, com formulário completo pra análise inteligente e
          rastreável da dívida.
        </p>
      </div>
      <AddLiabilityCard />
      <Card>
        <CardHeader>
          <CardTitle>Passivos cadastrados</CardTitle>
        </CardHeader>
        <CardBody>
          {list.isLoading ? (
            <Loading label="Carregando passivos" bars={SKELETON_BARS.PASSIVOS} />
          ) : list.isError ? (
            <ErrorState
              message="Não foi possível carregar seus passivos. Verifique sua conexão e tente de novo."
              onRetry={() => void list.refetch()}
            />
          ) : list.data && list.data.data.length > 0 ? (
            <LiabilityTable items={list.data.data} />
          ) : (
            <Empty copy={EMPTY_STATES.PASSIVOS} />
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function AddLiabilityCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar passivo</CardTitle>
      </CardHeader>
      <CardBody>
        <LiabilityForm />
      </CardBody>
    </Card>
  )
}

/**
 * O "Valor da parcela" que a pessoa declara no formulário NÃO volta para a tela.
 * Ele é campo obrigatório do cadastro (Wireframe `40:2` nó `90:30` "Valor da
 * parcela *"), mas nenhum frame o mostra de volta: a linha da lista desenha só
 * "Saldo devedor" (`90:66`/`90:67`) e "Parcelas" (`90:69`/`90:70`) — igual no
 * Mockup `933:1416`, linha `934:66` (`934:71`/`934:72` e `934:74`/`934:75`) — e
 * o card "Informações da Dívida" do Detalhe do Passivo (`91:2`) tem quatro
 * itens: Valor original, Saldo devedor atual, Taxa de juros atual e Parcelas.
 * A coluna "Parcela" que existia aqui era invenção, e era ela que fazia parecer
 * haver uma divergência "declarado × calculado" a mostrar para a pessoa —
 * o cronograma vem de taxa + amortização (`src/domain/assets/installments.ts`,
 * nota de design `164:2`).
 *
 * RESOLVIDO em 2026-09-07 (decisão de produto): a coluna passou a ser "Saldo
 * devedor", que é o que os dois frames desenham (`90:66`/`90:67` e o Mockup
 * `934:71`/`934:72`) — o valor original é histórico, o saldo é o número do dia
 * a dia. Exigiu `outstandingBalance` no contrato da lista, agora servido por
 * `src/app/api/v1/liabilities/_serialize.ts`.
 *
 * O formato de TABELA continua sendo nosso: o frame desenha uma linha por
 * passivo, não uma grade com cabeçalho. Fica registrado como divergência de
 * layout conhecida, não de conteúdo.
 */
function LiabilityTable({ items }: { items: readonly Liability[] }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Nome</TableHeader>
          <TableHeader>Credor</TableHeader>
          <TableHeader>Entidade</TableHeader>
          <TableHeader>Classificação</TableHeader>
          <TableHeader numeric>Saldo devedor</TableHeader>
          <TableHeader numeric>Parcelas</TableHeader>
          <TableHeader numeric>Taxa (a.m.)</TableHeader>
          <TableHeader aria-label="Ações" />
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.creditor}</TableCell>
            <TableCell>{item.entity}</TableCell>
            <TableCell>{LABEL_CLASSIFICATION[item.classification]}</TableCell>
            <TableCell numeric>{formatMoney(cents(item.outstandingBalance))}</TableCell>
            <TableCell numeric>
              {item.installmentsAlreadyPaid}/{item.installmentCount}
            </TableCell>
            <TableCell numeric>{formatPercent(item.monthlyInterestRate * 100, 2)}</TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-4">
                {/* files_design/04: "Analisar — Botão que abre o Detalhe do
                    Passivo, na lista de Passivos", ao lado de Descartar. A
                    tela de destino (files_design/01 §12) é de outro grupo de
                    trabalho ("Revisão de Recorrentes + Detalhe do Passivo");
                    este link é o único jeito de alcançá-la a partir daqui. */}
                <Button asChild variant="secondary" size="compact">
                  <Link href={`/passivos/${item.id}`}>Analisar</Link>
                </Button>
                <DiscardLiabilityButton id={item.id} name={item.name} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DiscardLiabilityButton({ id, name }: { id: string; name: string }) {
  const remove = liabilities.useRemove()
  /* P38 (design, 2026-09-09): a linha de consequência do `34:36`. O Figma só a
     desenha para o "Descartar" da Revisão de Recorrentes, onde ela diz algo
     tranquilizador ("a série continua normalmente"); aqui a consequência é o
     oposto, e foi medida: este "Descartar" APAGA o cadastro, e o RESTRICT do
     banco recusa com 409 quando algo ainda aponta para ele. São as duas coisas
     que a pessoa não pode adivinhar. */
  return (
    <ConfirmActionButton
      label="Descartar"
      // O único dos quatro que não fala de bloqueio, e por medição: o
      // `remove()` de liabilities.repository.ts apaga reajustes, parcelas e
      // eventos de rastreabilidade na MESMA transação, antes da dívida — não
      // sobra FK para recusar. A frase promete o que de fato leva junto.
      consequence="Isso apaga a dívida, com o cronograma de parcelas e o histórico dela."
      itemName={name}
      pending={remove.isPending}
      onConfirm={() => remove.mutateAsync(id)}
    />
  )
}
