import { DEFAULT_BLOCKS, DEFAULT_CATEGORIES, UNCATEGORIZED_CATEGORIES } from './types'
import { describe, expect, it } from 'vitest'

import { asId, type CategoryId } from '@/domain/core'
import { BLOCK_IDS, DISCRETIONARY_CATEGORY_ID, type ChartOfAccounts } from './types'
import {
  archiveCategory,
  blockOfCategory,
  categoriesOfBlock,
  createCategory,
  initializeChartOfAccounts,
  normalizeForSearch,
  renameCategory,
  searchCategories,
  blockAcceptsKind,
  categoriesForKind,
  suggestClassification,
  updateSuggestedClassification,
} from './rules'

describe('normalizeForSearch', () => {
  it('strips accents, lower-cases and collapses inner whitespace', () => {
    expect(normalizeForSearch('Vestuário')).toBe('vestuario')
    expect(normalizeForSearch('  Água   e Luz  ')).toBe('agua e luz')
  })
})

describe('initializeChartOfAccounts', () => {
  it('PRD §1 — starts from the 10 fixed blocks and the reference categories', () => {
    const chart = initializeChartOfAccounts()
    expect(chart.blocks).toHaveLength(10)
    expect(chart.categories.length).toBeGreaterThan(0)
  })

  it('gives back independent copies, so mutating the result cannot reach the module constants', () => {
    const first = initializeChartOfAccounts()
    const second = initializeChartOfAccounts()
    expect(first.blocks).not.toBe(second.blocks)
    expect(first.categories).not.toBe(second.categories)
    expect(first).toEqual(second)
  })
})

describe('categoriesOfBlock', () => {
  it('files_design/01 §3.1 — keeps the reference order of the block, not alphabetical', () => {
    const chart = initializeChartOfAccounts()
    const names = categoriesOfBlock(chart, BLOCK_IDS.personalExpenses).map((c) => c.name)
    expect(names).toEqual([
      'Alimentação',
      'Transporte',
      'Lazer/Entretenimento',
      'Vestuário',
      'Outras despesas pessoais',
      'Consumo Livre',
    ])
  })

  it('Figma 51:32 — D&A has no categories, the one read-only block', () => {
    const chart = initializeChartOfAccounts()
    expect(categoriesOfBlock(chart, BLOCK_IDS.depreciationAndAmortization)).toEqual([])
  })
})

describe('blockOfCategory', () => {
  it('resolves the block a category lives in', () => {
    const chart = initializeChartOfAccounts()
    const block = blockOfCategory(chart, DISCRETIONARY_CATEGORY_ID)
    expect(block?.id).toBe(BLOCK_IDS.personalExpenses)
  })

  it('answers null for an unknown category, instead of throwing', () => {
    const chart = initializeChartOfAccounts()
    expect(blockOfCategory(chart, asId<CategoryId>('does-not-exist'))).toBeNull()
  })
})

describe('searchCategories — "Buscar e Criar" (Figma 166:2)', () => {
  it('PRD v7.46 — "A categorizar" nunca é oferecida para escolha: é só o destino provisório do que vem do banco', () => {
    const comSistema = [...DEFAULT_CATEGORIES, ...UNCATEGORIZED_CATEGORIES]
    expect(searchCategories(comSistema, '').some((c) => c.name === 'A categorizar')).toBe(false)
    expect(searchCategories(comSistema, 'categ').some((c) => c.name === 'A categorizar')).toBe(
      false,
    )
  })

  const chart = initializeChartOfAccounts()
  const inBlock = categoriesOfBlock(chart, BLOCK_IDS.personalExpenses)

  it('with no term, returns the full list in alphabetical (accent-insensitive) order', () => {
    const names = searchCategories(inBlock, '').map((c) => c.name)
    expect(names).toEqual([
      'Alimentação',
      'Consumo Livre',
      'Lazer/Entretenimento',
      'Outras despesas pessoais',
      'Transporte',
      'Vestuário',
    ])
  })

  it('Figma 48:2 — "vestuario" (no accent) finds "Vestuário"', () => {
    expect(searchCategories(inBlock, 'vestuario').map((c) => c.name)).toEqual(['Vestuário'])
  })

  it('matches by substring, not only prefix', () => {
    expect(searchCategories(inBlock, 'ment').map((c) => c.name)).toEqual([
      'Alimentação',
      'Lazer/Entretenimento',
    ])
  })

  it('files_design/01 §3.1 — never offers an archived category', () => {
    const withArchived = createCategory(
      { blocks: chart.blocks, categories: inBlock },
      { id: asId('academia'), blockId: BLOCK_IDS.personalExpenses, name: 'Academia' },
    )
    const archived = archiveCategory(withArchived, asId('academia'))
    const found = searchCategories(archived.categories, 'academia')
    expect(found).toEqual([])
  })
})

describe('createCategory — UC16', () => {
  function chart(): ChartOfAccounts {
    return initializeChartOfAccounts()
  }

  it('UC16 — creates a category inside an existing block', () => {
    const created = createCategory(chart(), {
      id: asId('cafe'),
      blockId: BLOCK_IDS.personalExpenses,
      name: 'Café',
    })
    const found = created.categories.find((c) => c.id === asId('cafe'))
    expect(found).toMatchObject({
      blockId: BLOCK_IDS.personalExpenses,
      name: 'Café',
      isSystem: false,
      archived: false,
      suggestedClassification: null,
    })
  })

  it('trims the name before storing it', () => {
    const created = createCategory(chart(), {
      id: asId('cafe'),
      blockId: BLOCK_IDS.personalExpenses,
      name: '  Café  ',
    })
    expect(created.categories.find((c) => c.id === asId('cafe'))?.name).toBe('Café')
  })

  it('carries the suggested classification when the caller provides one', () => {
    const created = createCategory(chart(), {
      id: asId('financiamento-x'),
      blockId: BLOCK_IDS.administrativeExpenses,
      name: 'Financiamento X',
      suggestedClassification: 'NonCurrent',
    })
    expect(created.categories.find((c) => c.id === asId('financiamento-x'))).toMatchObject({
      suggestedClassification: 'NonCurrent',
    })
  })

  it('rejects a block that does not exist', () => {
    expect(() =>
      createCategory(chart(), {
        id: asId('x'),
        blockId: asId('does-not-exist'),
        name: 'X',
      }),
    ).toThrow('chart_of_accounts.unknown_block')
  })

  it('Figma 331:106 — D&A is the one read-only block, even for a well-formed draft', () => {
    expect(() =>
      createCategory(chart(), {
        id: asId('depreciacao-do-carro'),
        blockId: BLOCK_IDS.depreciationAndAmortization,
        name: 'Depreciação do carro',
      }),
    ).toThrow('chart_of_accounts.block_refuses_categories')
  })

  it('files_design/01 §5.6 — rejects a blank name', () => {
    expect(() =>
      createCategory(chart(), { id: asId('x'), blockId: BLOCK_IDS.personalExpenses, name: '   ' }),
    ).toThrow('chart_of_accounts.blank_name')
  })

  it('rejects an id already used in the chart', () => {
    expect(() =>
      createCategory(chart(), {
        id: DISCRETIONARY_CATEGORY_ID,
        blockId: BLOCK_IDS.personalExpenses,
        name: 'Outro nome',
      }),
    ).toThrow('chart_of_accounts.duplicate_id')
  })

  it('Figma 48:21 — rejects a name already active in the same block, "Não há opção de criar duplicata"', () => {
    expect(() =>
      createCategory(chart(), {
        id: asId('vestuario-2'),
        blockId: BLOCK_IDS.personalExpenses,
        name: 'vestuario',
      }),
    ).toThrow('chart_of_accounts.duplicate_name')
  })

  it('allows the same name in a DIFFERENT block — the duplicate check is scoped per block', () => {
    const created = createCategory(chart(), {
      id: asId('vestuario-pj'),
      blockId: BLOCK_IDS.administrativeExpenses,
      name: 'Vestuário',
    })
    expect(created.categories.find((c) => c.id === asId('vestuario-pj'))).toBeDefined()
  })

  it('allows re-creating a name that was archived — an archived namesake does not block it', () => {
    const withArchived = archiveCategory(chart(), asId('academia'))
    const recreated = createCategory(withArchived, {
      id: asId('academia-2'),
      blockId: BLOCK_IDS.costOfServices,
      name: 'Academia',
    })
    expect(
      recreated.categories.filter((c) => normalizeForSearch(c.name) === 'academia'),
    ).toHaveLength(2)
  })
})

describe('renameCategory — Figma 46:33 "Editar"', () => {
  function chart(): ChartOfAccounts {
    return initializeChartOfAccounts()
  }

  it('renames a category, keeping its id and block', () => {
    const original = chart().categories.find((c) => c.id === asId('vestuario'))!
    const renamed = renameCategory(chart(), asId('vestuario'), 'Roupas')
    const updated = renamed.categories.find((c) => c.id === asId('vestuario'))
    expect(updated?.name).toBe('Roupas')
    expect(updated?.blockId).toBe(original.blockId)
  })

  it('trims the new name', () => {
    const renamed = renameCategory(chart(), asId('vestuario'), '  Roupas  ')
    expect(renamed.categories.find((c) => c.id === asId('vestuario'))?.name).toBe('Roupas')
  })

  it('allows the person to fix only the spelling of their own name (case/accent)', () => {
    expect(() => renameCategory(chart(), asId('vestuario'), 'vestuario')).not.toThrow()
  })

  it('files_design/01 §5.6 — rejects a blank name', () => {
    expect(() => renameCategory(chart(), asId('vestuario'), '   ')).toThrow(
      'chart_of_accounts.blank_name',
    )
  })

  it('rejects a name already taken by ANOTHER category in the same block', () => {
    expect(() => renameCategory(chart(), asId('vestuario'), 'Transporte')).toThrow(
      'chart_of_accounts.duplicate_name',
    )
  })

  it('rejects an unknown category id', () => {
    expect(() => renameCategory(chart(), asId('does-not-exist'), 'X')).toThrow(
      'chart_of_accounts.unknown_category',
    )
  })

  it(
    'GLOSSARY.md — "Consumo Livre" is a system category, fixed where the product put it: ' +
      'renaming it must fail, not silently succeed',
    () => {
      expect(() => renameCategory(chart(), DISCRETIONARY_CATEGORY_ID, 'Gastos livres')).toThrow(
        'chart_of_accounts.system_category_is_fixed',
      )
    },
  )
})

describe('archiveCategory — "Descartar" (Figma 44:43)', () => {
  function chart(): ChartOfAccounts {
    return initializeChartOfAccounts()
  }

  it('files_design/01 §3.1 — archives instead of deleting: the record stays in the chart', () => {
    const archived = archiveCategory(chart(), asId('vestuario'))
    const found = archived.categories.find((c) => c.id === asId('vestuario'))
    expect(found).toBeDefined()
    expect(found?.archived).toBe(true)
  })

  it('archiving twice is not an error — the second call is a no-op', () => {
    const once = archiveCategory(chart(), asId('vestuario'))
    const twice = archiveCategory(once, asId('vestuario'))
    expect(twice).toEqual(once)
  })

  it('rejects an unknown category id', () => {
    expect(() => archiveCategory(chart(), asId('does-not-exist'))).toThrow(
      'chart_of_accounts.unknown_category',
    )
  })

  it('Consumo Livre cannot be archived: the widget always posts to it', () => {
    expect(() => archiveCategory(chart(), DISCRETIONARY_CATEGORY_ID)).toThrow(
      'chart_of_accounts.system_category_is_fixed',
    )
  })
})

describe('updateSuggestedClassification', () => {
  function chart(): ChartOfAccounts {
    return initializeChartOfAccounts()
  }

  it('sets the suggestion a category hands to Novo Lançamento', () => {
    const updated = updateSuggestedClassification(chart(), asId('vestuario'), 'Current')
    expect(
      updated.categories.find((c) => c.id === asId('vestuario'))?.suggestedClassification,
    ).toBe('Current')
  })

  it('clears the suggestion back to null', () => {
    const set = updateSuggestedClassification(chart(), asId('vestuario'), 'Current')
    const cleared = updateSuggestedClassification(set, asId('vestuario'), null)
    expect(
      cleared.categories.find((c) => c.id === asId('vestuario'))?.suggestedClassification,
    ).toBeNull()
  })

  it('refuses to change the suggestion of a system category, same guard as rename', () => {
    expect(() =>
      updateSuggestedClassification(chart(), DISCRETIONARY_CATEGORY_ID, 'Current'),
    ).toThrow('chart_of_accounts.system_category_is_fixed')
  })

  it('rejects an unknown category id', () => {
    expect(() => updateSuggestedClassification(chart(), asId('does-not-exist'), 'Current')).toThrow(
      'chart_of_accounts.unknown_category',
    )
  })
})

describe('suggestClassification — keyword suggestion for Classificação', () => {
  it('PRD §Balanço — "curto prazo" wins over the noun it qualifies', () => {
    expect(suggestClassification('Financiamento de curto prazo')).toBe('Current')
  })

  it('PRD §Balanço — "longo prazo" suggests NonCurrent', () => {
    expect(suggestClassification('Empréstimo de longo prazo')).toBe('NonCurrent')
  })

  it('PRD §Balanço — a bare "financiamento" suggests NonCurrent', () => {
    expect(suggestClassification('Financiamento do carro')).toBe('NonCurrent')
  })

  it('PRD §Balanço — "cartao" suggests Current', () => {
    expect(suggestClassification('Fatura do cartão')).toBe('Current')
  })

  it('is accent- and case-insensitive', () => {
    expect(suggestClassification('EMPRÉSTIMO pessoal')).toBe('NonCurrent')
  })

  it('answers null when no keyword is recognised, instead of guessing', () => {
    expect(suggestClassification('Assinaturas e ferramentas')).toBeNull()
  })

  it('answers null for a blank name', () => {
    expect(suggestClassification('   ')).toBeNull()
  })
})

/**
 * P7, decidido em 2026-09-09: a lista ganhou um segundo bloco, de palavras que
 * a pessoa digita e o PRD não escreve. O vocabulário do PRD continua tendo
 * prioridade — ele vem antes na lista, e `find` para no primeiro que casa.
 */
describe('suggestClassification — as palavras coloquiais (P7)', () => {
  it.each([
    ['Consórcio do carro', 'NonCurrent'],
    ['Tesouro Direto Selic', 'NonCurrent'],
    ['FGTS', 'NonCurrent'],
    ['Cheque especial do Itaú', 'Current'],
    ['Crediário da loja', 'Current'],
    ['Parcelamento da geladeira', 'Current'],
    ['Poupança', 'Current'],
    ['CDB liquidez diária', 'Current'],
  ])('%s sugere %s', (name, expected) => {
    expect(suggestClassification(name)).toBe(expected)
  })

  it('a palavra do PRD ganha da coloquial quando as duas cabem no mesmo nome', () => {
    // "curto prazo" (PRD) vem antes de "consorcio" (coloquial) na lista.
    expect(suggestClassification('Consórcio de curto prazo')).toBe('Current')
  })

  it('nome sem palavra nenhuma continua sem sugestão, e não um palpite', () => {
    expect(suggestClassification('Dívida com a Larissa')).toBeNull()
  })
})

describe('blockAcceptsKind — despesa e receita no bloco certo', () => {
  it('PRD §5 cascata — medido em 2026-09-29: pró-labore lançado como DESPESA em "Salário/Pró-labore" (Receita Bruta) subtraía da receita', () => {
    expect(blockAcceptsKind('Add', 'Expense')).toBe(false)
    expect(blockAcceptsKind('Add', 'Revenue')).toBe(true)
  })

  it('bloco que subtrai só aceita despesa; bloco com sinal aceita as duas', () => {
    expect(blockAcceptsKind('Subtract', 'Revenue')).toBe(false)
    expect(blockAcceptsKind('Subtract', 'Expense')).toBe(true)
    expect(blockAcceptsKind('Signed', 'Revenue')).toBe(true)
    expect(blockAcceptsKind('Signed', 'Expense')).toBe(true)
  })
})

describe('categoriesForKind', () => {
  it('medido em 2026-09-29 — a aba Despesa não oferece "Salário/Pró-labore", que é de Receita Bruta', () => {
    const chart = { blocks: DEFAULT_BLOCKS, categories: DEFAULT_CATEGORIES }
    const despesa = categoriesForKind(chart.categories, chart.blocks, 'Expense').map((c) => c.name)
    const receita = categoriesForKind(chart.categories, chart.blocks, 'Revenue').map((c) => c.name)
    expect(despesa).not.toContain('Salário/Pró-labore')
    expect(receita).toContain('Salário/Pró-labore')
    expect(receita).not.toContain('Aluguel moradia')
  })
})
