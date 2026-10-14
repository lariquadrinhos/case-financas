import { CreditCardIcon } from '@/components/ui/icons'

/**
 * Marca de "Cartão de crédito" ao lado do nome de uma despesa (ADR-0021),
 * irmã da `RecurringMark`: ícone, não Etiqueta, pelo mesmo motivo (o Badge tem
 * quatro tipos fechados). O nome acessível e a dica dizem o nome do campo.
 * Pendente de design (`icon/credit-card`).
 */
export function CreditCardMark() {
  return (
    <span
      role="img"
      aria-label="Cartão de crédito"
      title="Cartão de crédito"
      className="inline-flex"
    >
      <CreditCardIcon />
    </span>
  )
}
