# ADR-0014 — Uma unidade de trabalho entre portas segregadas, sem mudar o formato de nenhuma

- **Status:** aceita (decisão de engenharia, 2026-09-04)
- **Estende:** ADR-0012 §3 (portas segregadas e a suíte de contrato compartilhada), ADR-0013
  letra I (Interface Segregation Principle)
- **Origem:** achado da auditoria de fidelidade da rodada de backend (contextos `entries` e
  `allocationSpending`), medido, não deduzido — ver §1.

## Contexto

O SOLID/ISP (ADR-0013 letra I) deu a este projeto 34 portas em 17 pares Reader/Writer, cada uma
pequena e focada: nenhum handler depende de mais do que usa. Isso é bom para leitura. Para
escrita, criou um problema real que a auditoria mediu, não hipotetizou.

`POST /api/v1/entries/{id}/payment` e `POST /api/v1/occurrences/{id}/payment` ("Marcar Pago")
gravam em três e quatro portas na mesma requisição: o Lançamento, o Evento de rastreabilidade e,
quando o pagamento diverge do previsto, a Pendência. `files_design/03` ("Marcar Pago") não
qualifica a regra: "pago a menos SEMPRE vira Pendência". Não "a menos que a terceira escrita
falhe".

Antes desta ADR, cada porta commitava sozinha, sem transação nenhuma amarrando as três. A
auditoria forçou a terceira escrita (`paymentDiscrepancyWriter.create`) a lançar um erro depois
das duas primeiras terem sucesso e mediu o resultado real: o Lançamento ficava `Paid`, o Evento
existia, e a Pendência nunca nascia. O "sempre" do PRD virou "às vezes", silenciosamente, sem
nenhum teste vermelho até esse probe — ver o achado 4 do contexto `allocationSpending` e o
achado 4 do contexto `entries` na revisão de 2026-09-04.

## Decisão

### §1 O bug, medido antes de decidir a correção

Reproduzido em `src/app/api/v1/entries/[id]/payment/route.test.ts`, teste "ADR-0014": um
`vi.spyOn(paymentDiscrepancyWriter, 'create').mockRejectedValueOnce(...)` depois de uma escrita
de "pago a menos" deixava, sem esta ADR, o Lançamento em `Paid`/valor pago e nenhuma Pendência
— confirmado revertendo a correção e vendo o teste ficar vermelho antes de restaurá-la.

### §2 `withTransaction`, no composition root, sem mudar a forma de nenhuma porta

`src/data/index.ts` já monta toda porta sobre o MESMO `BigornaDatabase`/conexão
(`src/data/sqlite/index.ts` passa o mesmo `db` para todo adaptador). Isso significa que a
atomicidade de uma escrita entre portas não exige reescrever nenhuma porta para aceitar um
parâmetro de transação — exige só amarrar a MESMA conexão com `BEGIN`/`COMMIT`/`ROLLBACK` ao
redor da sequência de chamadas que já existiam:

```ts
export async function withTransaction<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
  const repos = getRepositories()
  connection.exec('BEGIN IMMEDIATE')
  try {
    const result = await work(repos)
    connection.exec('COMMIT')
    return result
  } catch (err) {
    if (connection.inTransaction) connection.exec('ROLLBACK')
    throw err
  }
}
```

Nenhuma porta ganhou um parâmetro `tx` novo. Nenhuma interface de `src/data/contracts/` mudou.
Um handler que precisa de unidade de trabalho troca `getRepositories()` por
`withTransaction(async (repos) => {...})` e usa as mesmas portas de sempre lá dentro — o resto
do código de `entries/[id]/payment/route.ts` e `occurrences/[id]/payment/route.ts` não mudou de
forma, só de moldura.

### §3 `BEGIN IMMEDIATE`, não `BEGIN` liso

`IMMEDIATE` adquire o lock de escrita no início da transação, não na primeira instrução. Sob
WAL (`src/data/sqlite/client.ts`), isso evita a classe de erro "upgrade de transação deferida
para de escrita falhou por SQLITE_BUSY no meio do caminho" — melhor falhar cedo e por inteiro do
que no meio.

### §4 Aninhamento com `db.transaction()` nativo é seguro, verificado contra o binding real

`liabilities.repository.ts` já usa `db.transaction((tx) => {...})` (síncrono, API nativa do
Drizzle/better-sqlite3) para reescrever o cronograma de parcelas inteiro. Um `BEGIN IMMEDIATE`
manual por fora, seguido de uma chamada a esse método por dentro, não colide: o
`better-sqlite3` detecta `inTransaction === true` e o wrapper nativo usa `SAVEPOINT`/`RELEASE`
em vez de um segundo `BEGIN`. Não foi assumido — foi rodado direto contra o binding:

```
antes: false
depois do BEGIN raw: true
apos db.transaction aninhado (deveria usar savepoint): { c: 3 }
apos ROLLBACK do BEGIN externo, tudo devia sumir: { c: 0 }
```

Um `ROLLBACK` no `BEGIN IMMEDIATE` externo desfez também o que o `db.transaction()` aninhado
tinha aparentemente "commitado" no savepoint — exatamente o comportamento que unidade de
trabalho promete.

### §5 Por que não recriar as portas sobre um `tx` do Drizzle

A alternativa óbvia — `withTransaction` reconstrói `createSqliteRepositories(tx)` com um
handle de transação Drizzle em vez de reusar `getRepositories()` — foi descartada. O
`db.transaction()` nativo do driver better-sqlite3 exige um callback **síncrono**; os métodos de
porta são `async` (a interface promete `Promise<T>` para caber um adaptador futuro que seja
realmente assíncrono), e misturar os dois exigiria duplicar cada método de escrita numa variante
síncrona só para uso transacional — o "muda a forma de toda porta que participa" que a auditoria
já tinha identificado como o motivo de não corrigir isso inline. Amarrar a conexão por fora
custa duas linhas e zero mudança de porta.

### §6 O escopo desta rodada: os dois fluxos de "Marcar Pago"

Aplicado a `entries/[id]/payment` e `occurrences/[id]/payment`, os dois fluxos que a auditoria
mediu como quebrados. Outras escritas de vários passos que a mesma auditoria sinalizou como
"sem transação" (venda de bem material, cadastro de passivo, destinação do lucro) ficam de fora
desta ADR — cada uma precisa da própria verificação de que `withTransaction` cobre o caso
(algumas já usam `db.transaction` de porta única, que pode não precisar de nada a mais). Migrar
cada uma é trabalho de acompanhamento, não desta ADR.

## Consequências

- **`src/data/index.ts`**: `withTransaction` exportado; `setRepositories` ganhou um segundo
  parâmetro opcional (`connection`), usado pelo seam de teste.
- **`src/data/fixtures/test-repositories.ts`**: `TestRepositories` agora expõe `connection`, e
  `useTestRepositories` a vincula, para que um teste de rota que chama `withTransaction` exercite
  a transação de verdade em vez de lançar `transaction.unavailable`.
- **`src/app/api/v1/entries/[id]/payment/route.ts`** e
  **`src/app/api/v1/occurrences/[id]/payment/route.ts`**: a sequência de escritas passou para
  dentro de `withTransaction`; o formato da resposta não mudou.
- **Testes novos**: um por rota, nomeado "ADR-0014", forçando a última escrita a falhar e
  verificando que a primeira também não sobrou — os dois foram vistos vermelhos antes da
  correção e restaurados depois.
- **Não tocado**: os outros fluxos multi-porta que a auditoria sinalizou (§6) continuam sem
  unidade de trabalho, documentados como pendência, não como resolvidos.

## Explicitamente NÃO feito

- **Reconstruir as portas sobre um handle de transação Drizzle.** Ver §5.
- **Cobrir venda de bem material, cadastro de passivo e destinação do lucro nesta ADR.** Cada
  um precisa da própria verificação; ver §6.
- **Um helper genérico de "sagas" ou compensação.** SQLite com um único arquivo e um único
  processo escritor não precisa de coordenação distribuída — `BEGIN`/`COMMIT`/`ROLLBACK` reais
  bastam. Introduzir esse conceito agora seria abstração para um caso que este banco não tem.
