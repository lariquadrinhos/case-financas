# `src/api` — o contrato HTTP

> Uma página. Se você está prestes a inventar um segundo estilo de rota, de erro ou de
> resposta, a resposta já está aqui.

O contrato **são os schemas Zod**. O documento OpenAPI é **gerado** a partir deles
(`npm run api:spec` → `docs/api/openapi.json`, versionado), então os dois não podem divergir:
um spec escrito à mão é uma segunda fonte da verdade, e ela fica errada no primeiro campo novo.

## Os arquivos

| Arquivo                  | Papel                                                                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry.ts`            | O `OpenAPIRegistry` e o `z` já estendido. **Importe `z` daqui**, nunca de `zod` direto — é o que garante que `extendZodWithOpenApi` rodou antes do primeiro `.openapi()`                        |
| `http.ts`                | O vocabulário: caminho base, status, problem+json, `ok`/`created`/`noContent`/`list`, e a tabela de erro de domínio → status. Não importa nada de servidor, para o gerador conseguir carregá-lo |
| `handler.ts`             | O invólucro que toda rota usa: sessão, parse, delegação, mapeamento de erro                                                                                                                     |
| `contracts/<recurso>.ts` | Schemas de requisição e resposta de um recurso + `registry.registerPath` das operações                                                                                                          |
| `contracts/common.ts`    | Os primitivos (dinheiro, data, mês, enums), o envelope de lista, o `Problem` e `registerResource`                                                                                               |
| `openapi.ts`             | Monta o documento 3.1 a partir do registry                                                                                                                                                      |

## As convenções

**Caminho.** Base versionada `/api/v1`. Substantivo no plural, orientado a recurso:
`/api/v1/entries`, `/api/v1/entries/{id}`. Uma ação que não é CRUD vira sub-recurso:
`/api/v1/entries/{id}/payment`, `/api/v1/categories/{id}/archive`.

**Idioma.** O caminho da API é **inglês**. Ele é infraestrutura, não interface — a rota de tela
continua em pt-BR (`/inicio`, `/dre`), o texto da tela também, e o `title`/`detail` de um erro
também, porque quem lê é a pessoa (ADR-0010).

**Dinheiro e data.** Dinheiro é **inteiro de centavos**, sempre (`152000` = R$ 1.520,00). Data é
`"YYYY-MM-DD"`, mês é `"YYYY-MM"`. Não existe float de reais no contrato e não existe timestamp
para data de pagamento: o mês contábil é o mês da data que a pessoa informou (PRD §5).

**Obrigatoriedade.** Campo é **obrigatório por padrão** (files_design/03). As únicas três
exceções, e elas são exceções documentadas, não julgamento caso a caso:

1. **Rótulo**, onde existe (IR e Consumo Livre) — `nullable`, com default `null`.
2. **Campos de direcionamento/alocação** — a lista pode vir vazia. Deixar em branco _cria_ uma
   Pendência; nunca é erro de validação.
3. **Toggles/seletores com valor pré-selecionado** (Entidade, Classificação, Status, Cor,
   Recorrência) — `optional` **com `.default(...)`**, nunca `optional` e ausente:
   files_design/01 §5.6 diz que eles "nunca ficam vazios de qualquer forma".

**Objeto fechado.** Todo schema de requisição é `strictObject`. Uma chave desconhecida é
rejeitada, não ignorada — campo silenciosamente descartado é como um cliente passa a acreditar
que gravou algo que o servidor nunca guardou.

**Status.**

| Código | Quando                                                                                      |
| ------ | ------------------------------------------------------------------------------------------- |
| 200    | leitura, e ação que devolve o recurso                                                       |
| 201    | criação — **sempre com `Location`**                                                         |
| 204    | remoção                                                                                     |
| 400    | corpo malformado (não é JSON)                                                               |
| 401    | sem sessão                                                                                  |
| 404    | não existe **para este `userId`** (ADR-0008 §3: dizer que existe para outro já é vazamento) |
| 409    | conflito com o estado atual (já encerrado, nome duplicado, categoria de sistema)            |
| 422    | bem-formado, mas semanticamente inválido — inclusive **toda falha de schema**               |
| 500    | inesperado                                                                                  |

Falha de schema é 422 e não 400 de propósito: a regra fica uma só, "não é JSON → 400, é JSON e
não passou → 422", em vez de cada endpoint escolher.

**Erro.** RFC 9457, `application/problem+json`:

```json
{
  "type": "urn:bigorna:problem:entries.negative_paid_amount",
  "title": "Requisição inválida",
  "status": 422,
  "detail": "A operação não pôde ser concluída.",
  "instance": "/api/v1/entries/abc/payment",
  "code": "entries.negative_paid_amount",
  "errors": [{ "field": "paidAmount", "code": "too_small" }]
}
```

`type` é uma **URN**: a RFC pede uma URI, e uma URL resolvível convidaria o cliente a buscá-la —
exatamente a origem externa que a ADR-0009 §5 proíbe. `errors` só aparece em falha de validação.
**Nunca** vai stack trace, SQL nem caminho de arquivo — nem no corpo, nem no log.

**Lista.** Coleção responde `{ "data": [...], "meta": { "total": 57 } }`, com `total` **antes** da
paginação. Recurso único responde o objeto, sem envelope.

## Como escrever uma rota

```ts
export const POST = handler({
  operation: 'entries.create', // nome opaco, só para o log
  body: newEntrySchema,
  handle: async ({ session, body }) => {
    const { entryWriter } = getRepositories()
    const entry = await entryWriter.create(session.userId, toNewEntry(body))
    return created(resourcePath('entries', entry.id), entry)
  },
})
```

O que o `handler()` faz por você, e por isso não se repete em rota nenhuma:
`requireSession()` **antes** de qualquer parse (para um chamador sem sessão não conseguir sondar
o formato da API pelas mensagens de validação), o parse de params/query/body, e o mapeamento de
erro de domínio para status pela tabela única de `http.ts`.

O que **sobra** para o handler: parsear já está feito, então ele delega e serializa. Regra de
negócio dentro de um handler é defeito — ela mora em `src/domain`. Consulta SQL dentro de um
handler também: ele depende do **tipo da porta**, importado de `@/data`, nunca de
`@/data/sqlite` (o ESLint recusa).

## Quando você mudar o contrato

1. Mude o schema Zod (nunca o JSON).
2. Rode `npm run api:spec` e **comite** `docs/api/openapi.json` no mesmo commit. É o diff que
   mostra à próxima pessoa que o contrato mudou.
3. Se o conceito é novo, ele entra em `src/domain/GLOSSARY.md` **antes** do código.
4. Se a fonte da verdade não responde alguma coisa, não invente: marque
   `// OPEN QUESTION:` e acrescente a pergunta em `docs/PERGUNTAS-EM-ABERTO.md`.
