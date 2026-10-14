/**
 * `POST /api/v1/tangible-assets/{id}/sale` — "Vender Bem Material"
 * (files_design/01 §11).
 *
 * O que esta rota FAZ, e por muito tempo não fazia (P33, resolvida em
 * 2026-09-07): cria o Lançamento do Ganho/Perda em Resultado Não Operacional.
 * O modal sempre prometeu isso — "Lançado automaticamente em Resultado Não
 * Operacional", texto literal do frame `99:56` e de `files_design/01 §11` — e
 * o Lançamento nunca era escrito, então o ganho não aparecia em DRE, Balanço,
 * Evolução Mensal nem Indicadores. Só o JSON da própria resposta o mostrava, e
 * ninguém o guardava.
 *
 * A conta vem do corpo (`gainAccountId`), pedida no próprio modal: todo
 * `Entry` de Receita/Despesa exige `bankAccountId`, e nenhum frame desenhava
 * esse campo — decisão de produto de 2026-09-07 foi pedi-la ali.
 *
 * O que esta rota continua NÃO fazendo, de propósito, igual ao cabeçalho de
 * `evaluateAssetSale`: não mexe no `accumulatedValue` de um Investimento, não
 * amortiza um Passivo e não lança Receita pelos `allocations` escolhidos —
 * "Redirecionamento" como uma operação só, através de cinco telas, é questão
 * de arquitetura em aberto (Event Storming H12), não algo que este endpoint
 * deva decidir em silêncio.
 */

import { evaluateAssetSale } from '@/domain/assets'
import { GAIN_ON_ASSET_SALE_CATEGORY_ID } from '@/domain/chart-of-accounts'
import {
  add,
  asId,
  cents,
  isNegative,
  isoDate,
  isZero,
  negate,
  type BankAccountId,
  type TangibleAssetId,
} from '@/domain/core'
import { assertAllocationTargetsExist, toAllocations } from '@/api/allocations'
import { withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { assetSaleSchema } from '@/api/contracts/tangible-assets'
import { idParams } from '@/api/contracts/common'

export const POST = handler({
  operation: 'tangible_assets.sell',
  params: idParams,
  body: assetSaleSchema,
  handle: async ({ session, params, body }) => {
    const assetId = asId<TangibleAssetId>(params.id)
    // A rota escreve em até QUATRO portas (bem, lançamento, investimento de
    // destino, pendência) e desde a ADR-0017 §4 uma delas mexe em dinheiro.
    // Fora de transação, uma falha no meio deixava o bem vendido e o destino
    // sem receber — ADR-0014, o mesmo motivo de "Marcar Pago".
    return withTransaction(async (repos) => {
      const {
        tangibleAssetReader,
        tangibleAssetWriter,
        pendingAllocationWriter,
        entryWriter,
        investmentReader,
        investmentWriter,
      } = repos
      const asset = await tangibleAssetReader.findById(session.userId, assetId)
      if (asset === null) {
        throw new NotFoundError('O bem material solicitado não existe.')
      }

      const saleDate = isoDate(body.date)
      const allocations = toAllocations(body.allocations)
      // Before evaluating: an allocation subtracts from what stays undirected, so
      // a target naming nothing would consume the value and leave no Pendência
      // behind (UC37). See `assertAllocationTargetsExist`.
      await assertAllocationTargetsExist(session.userId, allocations)

      const evaluation = evaluateAssetSale(asset, {
        tangibleAssetId: assetId,
        amount: cents(body.amount),
        date: saleDate,
        allocations,
      })

      const soldAsset = await tangibleAssetWriter.replace(session.userId, {
        ...asset,
        soldOn: saleDate,
      })

      // O Ganho/Perda vira um Lançamento de verdade, que é o que o modal promete.
      // Ganho é Receita, perda é Despesa — a cascata do DRE já soma o bloco
      // Resultado Não Operacional com o sinal de cada lançamento, então o valor
      // vai sempre como MAGNITUDE e quem carrega o sinal é o `kind`.
      // `Paid`: a venda aconteceu na data informada, não é planejamento.
      if (!isZero(evaluation.gainOrLoss)) {
        const loss = isNegative(evaluation.gainOrLoss)
        await entryWriter.create(session.userId, {
          kind: loss ? 'Expense' : 'Revenue',
          amount: loss ? negate(evaluation.gainOrLoss) : evaluation.gainOrLoss,
          date: saleDate,
          status: 'Paid',
          recurrenceId: null,
          entity: asset.entity,
          categoryId: GAIN_ON_ASSET_SALE_CATEGORY_ID,
          classification: 'Current',
          bankAccountId: asId<BankAccountId>(body.gainAccountId),
        })
      }

      // ADR-0017 §4: o Direcionamento CREDITA o destino. Sem isto, vender um bem
      // de R$ 300.000 por R$ 350.000 e direcionar tudo tirava o bem do Ativo e
      // não punha nada no lugar — o Patrimônio Líquido caía R$ 300.000 numa
      // operação que devia subir R$ 50.000.
      //
      // Creditar sem debitar está certo AQUI, e só aqui entre as três origens,
      // porque a contrapartida é explícita: o bem sai do Ativo no mesmo instante
      // (`soldOn`, logo acima). Na Destinação do Lucro não existe conta de origem
      // no agregado, e creditar infla o Balanço; por isso ela continua só
      // registrando.
      for (const allocation of allocations) {
        if (allocation.kind === 'Investment') {
          const investimento = await investmentReader.findById(session.userId, allocation.target)
          if (investimento === null) {
            throw new NotFoundError('O investimento de destino não existe.')
          }
          await investmentWriter.replace(session.userId, {
            ...investimento,
            accumulatedValue: add(investimento.accumulatedValue, allocation.amount),
          })
        }
        // Passivo é RECUSADO, não ignorado. Abater dívida é amortização
        // extraordinária: o saldo devedor é derivado do cronograma, e mexer nele
        // é decisão de produto que ninguém tomou (ADR-0017, "Explicitamente NÃO
        // feito"). Gravar a escolha e não fazer nada era um no-op silencioso — a
        // mesma classe de defeito que a recusa muda do "Descartar".
        if (allocation.kind === 'Liability') {
          throw new Error('allocations.liability_not_supported')
        }
      }

      // Only what is left undirected becomes a Pendência (files_design/03,
      // "Pendente de Direcionamento") — a fully directed sale creates none.
      if (!isZero(evaluation.pendingAmount)) {
        await pendingAllocationWriter.create(session.userId, {
          origin: { kind: 'TangibleAssetSale', tangibleAssetId: assetId },
          amount: evaluation.pendingAmount,
          originDate: saleDate,
          status: 'Pending',
        })
      }

      return ok({
        asset: soldAsset,
        gainOrLoss: evaluation.gainOrLoss,
        pendingAmount: evaluation.pendingAmount,
      })
    })
  },
})
