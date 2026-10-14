# ADR-0009 — LGPD e segurança da informação são premissa, não etapa posterior

- **Status:** aceita (decisão do dono, 2026-09-01)
- **Estende:** ADR-0008 (a costura de sessão é uma das medidas desta ADR)
- **Origem:**
  > "esse é um projeto web e ele deverá ser privado inicialmente, mas devemos nos preocupar com
  > LGPD e segurança da informação é primordial desde o início EM TUDO."

## Contexto

Este produto guarda quanto a pessoa ganha, quanto deve, onde o dinheiro está e com quem ela
gasta. Fora de saúde, não existe categoria de dado mais íntima. O PRD já reconhecia isso em §5
("dados sensíveis... requisitos de proteção de dados devem acompanhar a evolução do produto"),
mas deixava como acompanhamento, não como restrição de construção.

A forma cara do erro é conhecida e sempre a mesma: as medidas de segurança entram no fim, viram
um item de backlog, e aí competem com funcionalidade. O que não é estrutural não sobrevive à
primeira pressa.

Por isso esta ADR não descreve intenções: descreve mecanismos que **falham o build**.

## Decisão

### §1 Nenhum dado real de pessoa alguma entra no repositório

Toda fixture é sintética. `make audit-lgpd` falha quando encontra padrão de CPF ou CNPJ em
`src/data/fixtures`. A regra vale igualmente para issue, PR, print de tela, descrição de commit
e prompt de agente de IA — está no template de PR como checkbox e no `CONTRIBUTING.md`.

Isso não é zelo excessivo: um repositório privado hoje pode virar público amanhã, e um dado
real commitado sobrevive no histórico do git mesmo depois de removido do arquivo.

### §2 Content-Security-Policy com nonce, sem nenhuma origem externa

A CSP é gerada por requisição em `src/middleware.ts`, não em `next.config.ts`, porque o nonce
precisa ser novo a cada requisição.

A linha que mais importa neste produto é **`connect-src 'self'`**: mesmo que uma dependência
seja comprometida, o navegador recusa enviar qualquer coisa para outra origem. É a diferença
entre um pacote malicioso conseguir e não conseguir exfiltrar o extrato de alguém.

`script-src 'self' 'nonce-...' 'strict-dynamic'` sem `'unsafe-inline'`: o script que aplica o
tema antes da primeira pintura roda com nonce. Aceitar `'unsafe-inline'` para viabilizar esse
script permitiria também qualquer script injetado — exatamente o que a política existe para
impedir.

`style-src` mantém `'unsafe-inline'`: Tailwind e Next injetam estilo em tempo de execução e o
nonce não se propaga de forma confiável, e injeção de estilo não é caminho de exfiltração de
dado como injeção de script é. A exceção está declarada, não escondida.

Estáticos, em `next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, `Permissions-Policy` restritiva, `Cross-Origin-Opener-Policy`,
`Cross-Origin-Resource-Policy` e, em produção, `Strict-Transport-Security`.

**Verificado medindo, não deduzindo**: `curl -sI http://localhost:3000/inicio` mostra os
cabeçalhos, e o nonce do cabeçalho bate com o do HTML na mesma requisição. Um teste de
Playwright fixa isso.

### §3 O log registra QUE algo aconteceu, nunca O QUÊ

`src/lib/log.ts` é o único caminho. Ele redige por construção: valor monetário, nome de conta,
nome de categoria, rótulo e qualquer texto digitado pela pessoa viram `[redacted]`. Só evento,
resultado e identificador opaco saem.

`console.log` é **erro de ESLint** em `src/`. A regra existe porque a intenção não sobrevive a
uma sessão de depuração às onze da noite.

Consequência que precisa ser dita: a descrição de um `TraceEvent` ("Parcela #12 paga: previsto
R$ 1.520,00, pago R$ 1.540,00") contém valor monetário. Ela é dado do produto, exibido na tela,
e **nunca** pode ser passada ao logger.

### §4 Minimização

Não se coleta campo que nenhuma tela usa. **CPF, CNPJ, endereço e telefone não são coletados** —
o produto não precisa deles, e o campo que não existe não vaza.

A preferência de tema fica em `localStorage`, não em cookie: é preferência de exibição sem uso
no servidor, e mantê-la fora da requisição garante que não viaja junto com dado financeiro.

### §5 Nenhum recurso de terceiro no cliente

Sem analytics, sem fonte de CDN, sem pixel, sem script externo, sem biblioteca de gráfico.
A CSP já bloqueia; a regra existe para que ninguém tente e descubra pelo erro.

Consequência assumida: não há telemetria de uso. Para saber como o produto é usado, pergunta-se
à pessoa. É o preço de a instrumentação nunca ser o vazamento.

### §6 Direitos do titular têm lugar previsto, mesmo sem implementação

O dado já é escopado por `userId` (ADR-0008 §3), então acesso, correção, portabilidade e
eliminação têm onde entrar. **A implementação é da fase 2 e está registrada como pendência, não
como omissão** — a tabela de LGPD do `SECURITY.md` diz isso com todas as letras.

Base legal prevista: execução de contrato (LGPD art. 7º, V) para o funcionamento do produto;
consentimento para qualquer uso além disso. Compartilhamento: nenhum.

### §7 Os mecanismos rodam no CI, não na disciplina

`make audit-tokens`, `make audit-lgpd` e `npm audit` fazem parte do portão. Uma regra que
depende de alguém lembrar não é uma regra, é uma esperança.

## Consequências

- **`src/middleware.ts`**: criado só para a CSP com nonce.
- **`next.config.ts`**: cabeçalhos estáticos; a CSP não está lá, e o comentário diz por quê.
- **`src/lib/log.ts`**: lista de chaves proibidas; `console.error` é a saída, porque `stderr` é
  o canal de log estruturado.
- **`eslint.config.mjs`**: `no-console` como erro.
- **`Makefile`**: alvos `audit-tokens`, `audit-lgpd`, `audit-deps`.
- **`src/app/layout.tsx`**: `robots: noindex` e `referrer: no-referrer` no metadata.
- **`playwright.config.ts`**: vídeo desligado e screenshot só em falha — a tela mostra dado
  financeiro, e mesmo sendo sintético é o hábito que importa.
- **`SECURITY.md`**: modelo de ameaça com a coluna do que **não** está mitigado.

## Explicitamente NÃO feito

- **Criptografia em repouso.** O banco passou a existir (ADR-0012). O que foi feito é o mínimo
  do sistema de arquivos: o arquivo fica em `./.data/`, fora de `src/` e de `public/`, no
  `.gitignore`, com `chmod 0600` aplicado a **cada** abertura (e aos sidecars `-wal`/`-shm`), e o
  diretório com `0700`. Isso protege contra outra conta na mesma máquina; **não** protege contra
  quem tem a conta do dono nem contra um backup copiado para outro lugar. Criptografia de verdade
  (SQLCipher ou equivalente) continua não feita, e passa a depender de haver onde guardar a chave —
  o que depende de autenticação (ADR-0008).
- **Rate limiting, 2FA, auditoria de acesso.** Dependem de autenticação (ADR-0008).
- **Anonimização / pseudonimização do dado do titular.** O produto é de uma pessoa só por
  instância; não há dado de terceiro a pseudonimizar.
- **Nonce em `style-src`.** Ver §2: declarado como exceção, com o motivo.
- **Telemetria de erro (Sentry e similares).** Enviaria stack trace, e stack trace de app
  financeiro carrega dado. Se for necessário, entra com coleta no próprio domínio, via ADR.
