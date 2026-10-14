import { cn } from '@/lib/cn'

/**
 * Skeleton — uma barra do estado "Carregando". O Wireframe desenha 15 frames
 * "Carregando —" (`309:26` … `309:142`) e as 47 barras deles são todas de 14
 * de altura: é BARRA, nunca bloco maciço. Quem monta a pilha (recuo, gap e a
 * rampa de larguras de cada tela) é `patterns/loading.tsx`.
 *
 * `aria-hidden` because a screen reader must not read a placeholder as content;
 * the announcement is the job of the `Loading` wrapper, which carries the live
 * region.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-control bg-surface-subtle', className)}
      {...props}
    />
  )
}
