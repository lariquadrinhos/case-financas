import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogWidth,
} from './dialog'

/**
 * Métrica interna do Diálogo, medida contra o frame que o desenha.
 *
 * O DEFEITO que estes testes travam: o cabeçalho de dialog.tsx alegava cobrir
 * "every 'modal sobre Início' and 'modal sobre DRE' frame in the Figma" sem
 * citar UM node id, e três medidas do rodapé/corpo não saíram de frame nenhum.
 * O Mockup desenha o Diálogo em 991:2204 ("Diálogo", 460×694) e o Wireframe
 * desenha os mesmos rodapés em 99:63, 94:57 e 192:47 — nenhum dos dois foi
 * medido antes de escrever as classes.
 *
 * Geometria de 991:2204 (mcp__figma__get_metadata), filhos todos em x=24,
 * largura 412 (= 460 − 48):
 *   Título 991:2205   y= 24 h= 52 → termina  76
 *   Campo  991:2208   y= 92 h= 64 → termina 156
 *   Campo  991:2212   y=172 h= 64 → termina 236
 *   Ganho  991:2216   y=252 h= 44 → termina 296
 *   texto  991:2219   y=312 h= 18 → termina 330
 *   Direcionar 991:2220 y=346 h=166 → termina 512
 *   Nota   991:2232   y=528 h= 52 → termina 580
 *   "* Campo obrigatório" 991:2234 y=596 h=14 → termina 610
 *   Rodapé 991:2235   y=626 h= 44 → termina 670  (frame 694 = 670 + 24)
 * Os OITO gaps verticais medem 16: 76→92, 156→172, 236→252, 296→312,
 * 330→346, 512→528, 580→596, 610→626. Não existe gap de 20 em lugar nenhum.
 */

function renderPart(ui: React.ReactNode) {
  const { container } = render(
    <Dialog open>
      <DialogContent width="form">
        <DialogHeader data-testid="cabecalho">
          <DialogTitle>Vender Bem Material</DialogTitle>
          <DialogDescription>Civic 2020 · PF · registrado por R$ 45.000,00</DialogDescription>
        </DialogHeader>
        {ui}
      </DialogContent>
    </Dialog>,
  )
  void container
  const dialog = document.querySelector('[role="dialog"]')
  if (dialog === null) throw new Error('nenhum [role="dialog"] no DOM')
  return dialog
}

describe('Figma Mockup 991:2204 — métrica interna do Diálogo', () => {
  it('o corpo separa blocos por 16, não por 20 (os 8 gaps de 991:2204 medem 16)', () => {
    const dialog = renderPart(
      <DialogBody data-testid="corpo">
        <div />
        <div />
      </DialogBody>,
    )
    const body = dialog.querySelector('[data-testid="corpo"]')!
    expect(body.className).toContain('gap-16')
    expect(body.className).not.toContain('gap-20')
  })

  it('o rodapé fica 16 abaixo do bloco anterior (991:2234 termina em 610, 991:2235 começa em 626)', () => {
    const dialog = renderPart(<DialogFooter data-testid="rodape" />)
    const footer = dialog.querySelector('[data-testid="rodape"]')!
    expect(footer.className).toContain('pt-16')
    expect(footer.className).not.toContain('pt-20')
  })

  it('os botões do rodapé ficam a 12 um do outro (991:2236 x=0 w=200, 991:2238 x=212)', () => {
    const dialog = renderPart(<DialogFooter data-testid="rodape" />)
    const footer = dialog.querySelector('[data-testid="rodape"]')!
    expect(footer.className).toContain('gap-12')
    expect(footer.className).not.toContain('gap-8')
  })

  it('os botões dividem a largura do conteúdo em partes iguais, não alinham à direita (200 + 12 + 200 = 412)', () => {
    const dialog = renderPart(<DialogFooter data-testid="rodape" />)
    const footer = dialog.querySelector('[data-testid="rodape"]')!
    // Wireframe concorda nos quatro rodapés desenhados: 99:63 (197+10+197=404),
    // 94:57 (idem), 27:56 (254,5+10+254,5=519), 192:47 (177+10+177=364); e o
    // rodapé de um botão só ocupa a largura inteira — 192:13 (w=324 em 324) e
    // 345:1256 (w=280 em 280). `justify-end` com largura intrínseca não desenha
    // nenhum desses casos.
    expect(footer.className).toContain('[&>*]:flex-1')
    expect(footer.className).not.toContain('justify-end')
  })

  it('o cabeçalho já batia: Título 991:2205 em (24,24), gap 4 para o subtítulo, 16 até o próximo bloco', () => {
    const dialog = renderPart(<DialogBody />)
    const header = dialog.querySelector('[data-testid="cabecalho"]')!
    expect(header.className).toContain('gap-4')
    expect(header.className).toContain('p-24')
    expect(header.className).toContain('pb-16')
  })
})

/**
 * Posição HORIZONTAL do Diálogo — centralizado na **área de conteúdo** (à
 * direita da barra lateral), nunca na viewport inteira.
 *
 * O DEFEITO que estes testes travam: `dialog.tsx` posicionava com
 * `left-1/2 -translate-x-1/2`, ou seja no centro da viewport. Medido, não
 * deduzido (mcp__figma__get_metadata, arquivo 7IZBeQV15kgZp7Shcqh4c8, página
 * Mockup — todos em frame de 1440 com "Barra lateral" de 272):
 *
 *   1005:3051 "Diálogo"  x=616     w=480   Detalhe do Fluxo
 *   991:2204  "Diálogo"  x=626     w=460   Vender Bem Material
 *   997:2505  "Diálogo"  x=568,5   w=575   Destinar o Lucro
 *
 * Os três fecham na fórmula 🟩 de files_design/07 §10:
 * `x = sidebar + (frame − sidebar − diálogo) / 2`. O Wireframe local já dizia o
 * mesmo antes da Mockup existir — 99:39 (x=629, w=460) dentro de 99:2 (1440)
 * com Sidebar 99:3 de 278: 278 + (1440−278−460)/2 = 629 — e o irmão 99:36, a
 * própria área de conteúdo (x=278, w=1162), fecha igual: 278 + (1162−460)/2.
 *
 * Centralizar na viewport daria 720 − w/2 = 480, 490 e 432,5: desvio de
 * exatamente 136px (= 272/2, metade da barra lateral) para a esquerda, em toda
 * tela do produto — nenhum diálogo deste app é aberto fora de `(app)/layout`,
 * onde a barra lateral está sempre presente.
 *
 * O scrim NÃO se desloca junto: Wireframe 99:38 é um retângulo de 1440×900 em
 * (0,0), irmão do diálogo, cobrindo a barra lateral também.
 */

const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

/** Largura do frame de todo mockup de modal na página Mockup. */
const FRAME = 1440
const SIDEBAR = Number(/--width-sidebar:\s*(\d+)px;/.exec(tokensCss)?.[1])

/**
 * Resolve a classe de posição horizontal para o pixel em que o CENTRO do
 * diálogo cai num frame de 1440 — o jsdom não carrega o Tailwind, então a
 * conta que o navegador faria é feita aqui, com `--width-sidebar` lido do
 * tokens.css de verdade. Aceita as duas formas para poder ficar VERMELHO
 * contra a versão antiga (`left-1/2`) em vez de explodir com erro de parse.
 */
function horizontalCenter(className: string): number {
  const arbitrary = /left-\[([^\]]+)\]/.exec(className)?.[1]
  if (arbitrary === undefined) {
    if (/(?:^|\s)left-1\/2(?:\s|$)/.test(className)) return FRAME / 2
    throw new Error(`nenhuma classe de posição horizontal em "${className}"`)
  }
  const expression = arbitrary
    .replace(/_/g, '')
    .replace(/^calc\(([\s\S]*)\)$/, '$1')
    .replace(/var\(--width-sidebar\)/g, String(SIDEBAR))
    .replace(/50%/g, String(FRAME / 2))
  return expression.split('+').reduce((total, term) => {
    const value = term
      .split('/')
      .map(Number)
      .reduce((a, b) => a / b)
    if (!Number.isFinite(value)) throw new Error(`termo não numérico em left: "${term}"`)
    return total + value
  }, 0)
}

function renderWidth(width: DialogWidth) {
  render(
    <Dialog open>
      <DialogContent width={width}>
        <DialogHeader>
          <DialogTitle>Diálogo</DialogTitle>
          <DialogDescription>Descrição</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>,
  )
  const dialog = document.querySelector('[role="dialog"]')
  if (dialog === null) throw new Error('nenhum [role="dialog"] no DOM')
  return dialog
}

const MEASURED = [
  { screen: 'Detalhe do Fluxo', node: 'Mockup 1005:3051', width: 'narrow', size: 480, x: 616 },
  { screen: 'Vender Bem Material', node: 'Mockup 991:2204', width: 'form', size: 460, x: 626 },
  { screen: 'Destinar o Lucro', node: 'Mockup 997:2505', width: 'wide', size: 575, x: 568.5 },
] as const satisfies readonly {
  screen: string
  node: string
  width: DialogWidth
  size: number
  x: number
}[]

describe('Figma Mockup — o diálogo centraliza na área de conteúdo, não na viewport', () => {
  it.each(MEASURED)(
    '$node — $screen ($size de largura) começa em x=$x num frame de 1440',
    ({ width, size, x }) => {
      const dialog = renderWidth(width)
      // `-translate-x-1/2`: a classe `left` posiciona o CENTRO do diálogo; a
      // borda esquerda — o `x` que o Figma mede — é o centro menos metade da
      // largura do diálogo.
      expect(horizontalCenter(dialog.className) - size / 2).toBe(x)
    },
  )

  it('files_design/07 §10 — a fórmula 🟩 do design fecha com os três x medidos', () => {
    for (const { size, x } of MEASURED) {
      expect(SIDEBAR + (FRAME - SIDEBAR - size) / 2).toBe(x)
    }
  })

  it('o scrim continua cobrindo a viewport inteira (Wireframe 99:38, 1440×900 em 0,0)', () => {
    renderWidth('form')
    const overlay = Array.from(document.querySelectorAll('[data-state="open"]')).find(
      (element) => element.getAttribute('role') !== 'dialog',
    )
    expect(overlay?.className).toContain('inset-0')
  })
})
