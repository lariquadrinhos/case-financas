import { describe, expect, it } from 'vitest'
import { isNovoLancamentoOrigin } from './types'

// Relato de 2026-10-01: o formulário aberto em qualquer tela do app volta para
// ela; antes só Início, Histórico, DRE e Revisão eram reconhecidas.
describe('origem do Novo Lançamento', () => {
  it('toda tela do app com o botão "+ Novo Lançamento" é uma origem válida', () => {
    for (const route of [
      'inicio',
      'dre',
      'balanco-patrimonial',
      'evolucao-mensal',
      'indicadores-financeiros',
      'revisao-de-recorrentes',
      'historico',
      'plano-de-contas',
      'contas-bancarias',
      'bens-materiais',
      'investimentos',
      'passivos',
    ]) {
      expect(isNovoLancamentoOrigin(route)).toBe(true)
    }
  })

  it('o que não é uma tela do app não é origem (nada de redirecionar para fora)', () => {
    expect(isNovoLancamentoOrigin('https://exemplo.invalido')).toBe(false)
    expect(isNovoLancamentoOrigin('novo-lancamento')).toBe(false)
    expect(isNovoLancamentoOrigin(null)).toBe(false)
  })
})
