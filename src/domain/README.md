# `src/domain` — as regras puras

O domínio é a única camada que sabe o que é um Lançamento, um DRE e uma parcela de
financiamento. Ele não sabe que existe React, Next, banco ou HTTP (docs/ARCHITECTURE.md §3), não
lê relógio e não sorteia: toda função recebe por parâmetro o que precisa, inclusive o mês atual.
É o que torna cada cálculo testável sem congelar o tempo.

Identificadores em inglês (ADR-0010); texto de interface em pt-BR, palavra por palavra igual ao
Figma. A ponte normativa entre os dois idiomas é [`GLOSSARY.md`](./GLOSSARY.md) — leia antes de
nomear qualquer coisa, e acrescente a linha lá **antes** de escrever o código, nunca depois.

## Mapa dos módulos

| Pasta                     | Conceito de produto        | O que guarda                                                                                                                               |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `core/`                   | —                          | `Cents`, `IsoDate`/`Month`, ids marcados, `Entity`/`View`/`EntryStatus`/`EntryKind` e os `LABEL_*` em pt-BR                                |
| `chart-of-accounts/`      | Plano de Contas            | `StatementBlock`, `Category`, `DEFAULT_BLOCKS` (os 10 blocos), `DEFAULT_CATEGORIES`, `BLOCK_IDS`                                           |
| `entries/`                | Lançamento                 | `Entry` (união discriminada por `kind`), `NewEntry`, os type guards, `EntryFilter`                                                         |
| `recurrence/`             | Recorrência                | `Recurrence`, `RecurrenceTemplate`, `Occurrence`, `EditScope`                                                                              |
| `assets/`                 | Patrimônio                 | `BankAccount`, `TangibleAsset`, `Investment`, `Liability`, `Installment`, `RateAdjustment`, `AssetSale`, `Allocation`, `PendingAllocation` |
| `reports/`                | Relatórios                 | `IncomeStatement`, `BalanceSheet`, `MonthlyTrend`, `FinancialIndicators` e suas linhas                                                     |
| `profit-allocation/`      | Destinar o Lucro           | `AllocationBucket`, `AllocationItem`, `ProfitAllocation`                                                                                   |
| `trace-events/`           | Eventos de rastreabilidade | `TraceEvent`, `TraceEventOrigin`                                                                                                           |
| `discretionary-spending/` | Consumo Livre              | `DiscretionarySpendingConfig`, `DiscretionaryExpense`                                                                                      |

Cada pasta tem `types.ts` (os tipos, as constantes estruturais e os type guards triviais) e um
`index.ts` que reexporta. Importe sempre pela pasta: `from '@/domain/entries'`.

## A regra de dependência

```
                     ┌───────────────────┐
                     │       core        │  ← todo mundo depende dele
                     └───────────────────┘
                               ▲
   ┌───────────────┬───────────┼───────────┬────────────────────┐
   │               │           │           │                    │
chart-of-      entries ◀── recurrence   assets          profit-allocation
 accounts          ▲                      ▲             trace-events
   ▲               │                      │             discretionary-spending
   └───────────────┴────── reports ───────┘
```

- **`core` ← todo o resto.** Nenhum módulo do domínio pode ser importado por `core`.
- **`reports` ← `entries` + `chart-of-accounts` + `assets`.** Relatório é projeção sobre eles, e
  a seta aponta só nesse sentido: nenhum dos três sabe que existe um relatório.
- **`recurrence` ← `entries`.** Única dependência entre contextos além de `reports`:
  `RecurrenceTemplate` é literalmente o dado de um Lançamento copiado mês a mês
  (files_design/03 "Objeto Recorrência"), e duplicar a união `Entry` dentro de `recurrence` faria
  os dois modelos divergirem no primeiro campo novo. _Isto estende a nota de
  docs/ARCHITECTURE.md §2, que só previa a exceção de `reports`._
- Nenhum outro par de módulos se importa. `profit-allocation`, `trace-events` e
  `discretionary-spending` conhecem apenas `core`.

O que o domínio nunca importa: React, Next, `@/data`, `@/features`, `@/app`, `@/components`.

## Convenções que valem para todo arquivo daqui

- **Dinheiro é sempre `Cents`** — inteiro de centavos, nunca um `number` de reais fora de
  `fromReais`/`toReais` (ADR-0001 §5).
- **Mês de um lançamento é o mês da data de pagamento.** Regime de caixa, sem competência
  paralela; `Planned` não entra no DRE (PRD §5).
- **Nada de `any`, nada de `console.log`, nada de `Date.now()`/`Math.random()`.**
- **Erros com código snake_case:** `throw new Error('income_statement.invalid_month')`.
- **Comentário explica o porquê e cita a fonte** (`PRD §5`, `files_design/03 "Marcar Pago"`,
  `ADR-0003 §2`). Comentário que repete a linha é ruído.
- **Premissa não inventada:** o que não está nas fontes vira
  `// OPEN QUESTION: <pergunta>`, nunca uma regra inventada com cara de fato.
