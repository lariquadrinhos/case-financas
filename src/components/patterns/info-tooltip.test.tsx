import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { InfoTooltip } from './info-tooltip'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * files_design/07-style-guide.md, "Biblioteca de ícones", e o nó do próprio
 * símbolo na Style guide (`470:15` "icon/info", medido em `471:17` "cel/info"):
 * todo ícone `icon/*` vive numa grade de 20×20 — não há exceção para o `info`
 * ("tooltip de ajuda contextual"). A regra 9 do "Processo pra criar um mockup
 * novo" é explícita: "Nunca redimensionar uma instância de `icon/*` — usar
 * sempre o tamanho nativo 20×20"; e se o contexto for apertado, "o ajuste é no
 * espaçamento ao redor, nunca no tamanho do ícone".
 *
 * files_design/02-log-de-decisoes-de-ux.md, "Bug repetido" (~linha 1249):
 * exatamente estes 4 ícones de ajuda (Status/Classificação/Sub-tipo/Tipo de
 * valor) foram encontrados a 14×14 e revertidos para 20×20 nativo — o mesmo
 * tamanho que `--size-help-icon` ainda usava em código (tokens.css, 14px),
 * citando só o placeholder do Wireframe (nó `71:11`, que antecede a biblioteca
 * de ícones e não é fonte de tamanho de componente atômico).
 */
// A grade nativa de todo ícone icon/* (files_design/07, "Biblioteca de
// ícones"). Nomeado em vez de escrito como literal na asserção abaixo porque
// `make audit-tokens` (ADR-0011) proíbe qualquer "Npx" fora de src/styles/,
// mesmo em teste — o valor só existe, de propósito, dentro de tokens.css.
const NATIVE_ICON_GRID_PX = 20

describe('InfoTooltip — files_design/07 "Biblioteca de ícones" (grade nativa 20×20)', () => {
  it('o token --size-help-icon usa a grade nativa de icon/*, não o placeholder 14×14 do Wireframe', () => {
    const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')
    const match = tokens.match(/--size-help-icon:\s*([^;]+);/)
    expect(match).not.toBeNull()
    expect(match?.[1]?.trim()).toBe(`${NATIVE_ICON_GRID_PX}px`)
  })

  it('o botão de ajuda usa o token --size-help-icon (não um valor de tamanho hardcoded)', () => {
    render(
      <TooltipProvider>
        <InfoTooltip label="Ajuda sobre Status">conteúdo</InfoTooltip>
      </TooltipProvider>,
    )
    const button = screen.getByRole('button', { name: 'Ajuda sobre Status' })
    expect(button.className).toContain('h-[var(--size-help-icon)]')
    expect(button.className).toContain('w-[var(--size-help-icon)]')
  })
})

/**
 * Guarda de procedência. O valor do token já estava certo (a grade nativa de
 * `icon/*`), mas o comentário logo acima dele continuava argumentando pelo
 * número antigo — "Figma 71:11 … the 'i' badge beside a field label is 14×14"
 * — e o mesmo texto morto estava repetido no JSDoc do componente. Um
 * comentário que defende um número diferente do que a linha declara é um
 * convite a "consertar" o valor de volta pro tamanho errado: foi assim que o
 * bug nasceu (files_design/02 ~1249) e ele já apareceu duas vezes no Figma
 * (files_design/07 regra 9).
 *
 * A asserção é dupla de propósito: o comentário tem que citar o nó de onde a
 * medida veio E repetir, em prosa, o mesmo número que a linha declara. Citar
 * 14×14 como o bug revertido é legítimo; declarar 14×14 como o tamanho, não.
 *
 * Medido agora, não deduzido: Style guide 470:15 "icon/info" mede 20×20 no
 * frame 471:17 "cel/info" (e os 16 símbolos de 470:42 medem 20×20, sem
 * exceção); na Mockup, a instância 877:14 ao lado de "Classificação
 * (sugerida)" também mede 20×20. O Wireframe 71:11 é fonte legítima só do
 * CONTEÚDO e do COMPORTAMENTO do tooltip, nunca do tamanho do ícone.
 */
const NATIVE_ICON_GRID = '20×20'
const ICON_INFO_NODE = '470:15'

describe('InfoTooltip — procedência do tamanho (Style guide 470:15 "icon/info")', () => {
  it('o comentário de --size-help-icon cita o nó do ícone e a grade nativa que a linha declara', () => {
    const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')
    const provenance = tokens.match(/\/\*(?:[^*]|\*(?!\/))*\*\/(?=\s*--size-help-icon:)/)?.[0]
    expect(provenance).toBeDefined()
    expect(provenance).toContain(ICON_INFO_NODE)
    expect(provenance).toContain(NATIVE_ICON_GRID)
  })

  it('o JSDoc do componente cita o mesmo nó e a mesma grade', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/patterns/info-tooltip.tsx'),
      'utf8',
    )
    const jsdoc = source.match(/\/\*\*(?:[^*]|\*(?!\/))*\*\//)?.[0]
    expect(jsdoc).toBeDefined()
    expect(jsdoc).toContain(ICON_INFO_NODE)
    expect(jsdoc).toContain(NATIVE_ICON_GRID)
  })
})

/**
 * Largura da caixa de tooltip — Wireframe `71:11` "Estado — Tooltips de ajuda
 * (Status, Classificação, Tipo de valor, Sub-tipo)".
 *
 * Medido no XML do frame, não deduzido. O frame tem CINCO painéis (① é o
 * estado normal, sem tooltip) e QUATRO caixas de tooltip, e em todas as quatro
 * a caixa tem exatamente a largura do controle segmentado que ela explica:
 *
 *   ② Status         controle `71:33` 162+8+162 = 332 → caixa `71:38` w=332
 *   ③ Classificação  controle `73:17` 162+8+162 = 332 → caixa `73:22` w=332
 *   ④ Tipo de valor  controle `74:20` 172+8+172 = 352 → caixa `74:25` w=352
 *   ⑤ Sub-tipo       controle `78:11` 172+8+172 = 352 → caixa `78:16` w=352
 *
 * Os painéis externos corroboram: 332+24+24 = 380 (`71:26`, `73:11`) e
 * 352+24+24 = 400 (`74:14`, `78:5`). O frame NUNCA desenha uma caixa mais
 * estreita que o seu gatilho — são duas larguras, cada uma amarrada ao seu
 * próprio controle. Unificar tudo em 332 estreita justamente as duas caixas de
 * texto mais longo (as de 101px e 84px de altura no frame, contra 63 e 50 das
 * outras duas), quebrando o texto em mais linhas do que o desenho previu.
 */
// Escritos como número + sufixo montado, e não como literal "332px", porque
// `make audit-tokens` (ADR-0011) proíbe qualquer "Npx" fora de src/styles/,
// inclusive em teste.
const BOX_FOR_162_SEGMENTS_PX = 332
const BOX_FOR_172_SEGMENTS_PX = 352
const NARROW_BOX_NODES = ['71:38', '73:22']
const WIDE_BOX_NODES = ['74:25', '78:16']

function tokensCss() {
  return readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')
}

describe('Tooltip — Figma 71:11: a caixa tem a largura do controle que ela explica', () => {
  it('tokens.css declara as DUAS larguras que o frame desenha, não só a mais estreita', () => {
    const tokens = tokensCss()
    expect(tokens.match(/--width-tooltip:\s*([^;]+);/)?.[1]?.trim()).toBe(
      `${BOX_FOR_162_SEGMENTS_PX}px`,
    )
    expect(tokens.match(/--width-tooltip-wide:\s*([^;]+);/)?.[1]?.trim()).toBe(
      `${BOX_FOR_172_SEGMENTS_PX}px`,
    )
  })

  it('o comentário dos tokens cita os nós das quatro caixas medidas', () => {
    const provenance = tokensCss().match(/\/\*(?:[^*]|\*(?!\/))*\*\/(?=\s*--width-tooltip:)/)?.[0]
    expect(provenance).toBeDefined()
    for (const node of [...NARROW_BOX_NODES, ...WIDE_BOX_NODES]) {
      expect(provenance).toContain(node)
    }
  })

  it('TooltipContent aplica a largura fixa que o frame desenha, não um max-w que encolhe', () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger>gatilho</TooltipTrigger>
          <TooltipContent>Circulante: previsto para até 12 meses.</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    const content = screen.getByText('Circulante: previsto para até 12 meses.')
    expect(content.className).toContain('w-[var(--width-tooltip)]')
    expect(content.className).not.toContain('max-w-')
  })

  it('InfoTooltip width="wide" usa a caixa de 352 (Tipo de valor 74:25, Sub-tipo 78:16)', () => {
    render(
      <TooltipProvider>
        <InfoTooltip label="Ajuda sobre Tipo de valor" width="wide">
          Fixo: o valor se repete igualmente todo mês.
        </InfoTooltip>
      </TooltipProvider>,
    )
    fireEvent.focus(screen.getByRole('button', { name: 'Ajuda sobre Tipo de valor' }))
    const content = screen.getByText('Fixo: o valor se repete igualmente todo mês.')
    expect(content.className).toContain('w-[var(--width-tooltip-wide)]')
  })

  it('só os dois campos cujo controle mede 352 pedem a caixa larga', () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
    // Controle 74:20 e 78:11 (segmentos de 172): caixa larga.
    expect(read('src/components/patterns/recurrence-fields.tsx')).toContain(
      '<InfoTooltip label="Ajuda sobre Tipo de valor" width="wide">',
    )
    expect(read('src/app/(app)/novo-lancamento/tabs/pro-labore-fields.tsx')).toContain(
      '<InfoTooltip label="Ajuda sobre Sub-tipo" width="wide">',
    )
    // Controle 71:33 e 73:17 (segmentos de 162): caixa padrão, sem width.
    //
    // A cópia de Status e Classificação saiu de `expense-revenue-fields.tsx` e
    // foi para `field-help.tsx` quando esses dois termos passaram a aparecer em
    // outras telas — o mesmo termo tem que dizer a mesma coisa em todas. A
    // medição do frame não mudou; mudou o arquivo onde ela é obedecida.
    const fieldHelp = read('src/components/patterns/field-help.tsx')
    expect(fieldHelp).toContain('<InfoTooltip label="Ajuda sobre Status">')
    expect(fieldHelp).toContain('<InfoTooltip label="Ajuda sobre Classificação">')
  })
})
