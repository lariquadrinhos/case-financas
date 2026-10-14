/**
 * A marca do produto (pedido do dono, 2026-10-01: "vamos colocar um logo no
 * Bigorna"). Uma bigorna de ferreiro — o nome do repositório — em silhueta
 * cheia, 24×24, `currentColor`: herda a cor do texto ao lado e muda com o
 * tema sem token próprio. Inline, nunca imagem remota (CSP, ADR-0009).
 * NÃO ESTÁ NO FIGMA; pendente de design.
 */
export function BigornaMark({ className }: { className?: string }) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {/* Mesa com o chifre à esquerda, pescoço e base trapezoidal. */}
      <path d="M6 6h14a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1h-7v4h2l2 3v1H6v-1l2-3h2v-4H6L2 8.5 6 6Z" />
    </svg>
  )
}
