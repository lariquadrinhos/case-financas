# ADR — Architecture Decision Record

Toda decisão arquitetural — e toda mudança de negócio/produto que altere o que o PRD descrevia — é registrada como ADR. Nunca como edição silenciosa de um documento anterior.

## Regras

- **Numerada** para rastreabilidade (ex.: ADR-0001, ADR-0002, sequencial e imutável — não reutilize números).
- **Versionada** — uma ADR superada não é apagada; é marcada como substituída e referencia a que a sucede.
- Nasce do mapa de Event Storming, não de preferência isolada de quem escreve.

## Template

```
# ADR-NNNN: <título curto da decisão>

## Status
Proposta | Aceita | Substituída por ADR-XXXX | Depreciada

## Contexto
Qual problema motivou esta decisão? Que evidência do Event Storming sustenta isso?

## Decisão
O que foi decidido, de forma direta.

## Justificativa
Por que esta opção e não outra — a lógica, não só a conclusão.

## Alternativas consideradas
Para cada alternativa descartada: descrição + trade-offs (o que se ganha e o que se perde).
Alternativas não são omitidas mesmo quando óbvias em retrospecto.

## Consequências
O que essa decisão implica daqui para frente — positivo e negativo.
```

## Antes de registrar

Confirme que a decisão não está sendo tomada sobre uma premissa não verificada (`references/perguntas.md`). Se houver dúvida sobre o problema real, a ADR ainda não deve ser escrita — volte ao Event Storming.

## Onde fica

`/docs/adr/NNNN-titulo-curto.md` — um arquivo por ADR, na raiz do repositório. O número no nome do arquivo é o mesmo do título dentro do documento e nunca é reaproveitado, mesmo que a ADR seja substituída ou depreciada. Exemplo: `/docs/adr/0001-escolha-do-banco-de-dados.md`.
