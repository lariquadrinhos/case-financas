# Política de Segurança

Este projeto guarda **dados financeiros pessoais e empresariais**: quanto a pessoa ganha,
quanto deve, onde o dinheiro está, com quem ela gasta. Não existe categoria de dado mais
íntima que essa fora de saúde. Segurança aqui é premissa, não etapa posterior.

A ausência de autenticação **hoje** é uma decisão registrada (ADR-0008), não um esquecimento —
e é exatamente por isso que o ambiente desta fase é privado e nunca exposto à internet
pública. Ver §"Escopo e modelo de ameaça" abaixo, onde essa limitação está declarada em vez
de escondida.

## Versões suportadas

| Versão                      | Suportada |
| --------------------------- | --------- |
| `main`                      | ✅        |
| Qualquer branch de trabalho | ❌        |

Ainda não há release. Enquanto não houver, só o que está em `main` recebe correção.

## Reportando uma vulnerabilidade

**Não abra uma issue pública.** Uma issue de segurança aberta é um aviso para quem quiser
explorar antes da correção.

Use o canal privado: **[llquadros95@gmail.com](mailto:llquadros95@gmail.com)**, com o assunto
começando em `[SEGURANÇA]`. Se o repositório tiver o Private Vulnerability Reporting do GitHub
habilitado, prefira ele.

Inclua, se puder:

- O que é possível fazer que não deveria ser possível.
- Os passos exatos para reproduzir.
- O commit ou a branch em que você observou.
- O impacto que você enxerga.

**Não inclua dado real de pessoa alguma.** Use dado sintético para demonstrar o problema —
valores inventados, nomes inventados. Um relato de segurança que vaza dado real cria um
segundo incidente enquanto conserta o primeiro.

### O que esperar

| Etapa                             | Prazo                                             |
| --------------------------------- | ------------------------------------------------- |
| Confirmação de recebimento        | até 5 dias úteis                                  |
| Avaliação inicial e classificação | até 10 dias úteis                                 |
| Correção e divulgação coordenada  | conforme a gravidade, combinado com quem reportou |

Crédito a quem reportou é oferecido e opcional.

## Escopo e modelo de ameaça

O produto é uma aplicação web monolítica (Next.js), sem backend separado, sem banco nesta
fase, rodando em ambiente privado. As ameaças que importam e o que já as mitiga:

| Ameaça                                                      | Mitigação hoje                                                                                                                                                                                                                       | Onde                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Exfiltração de dado financeiro por dependência comprometida | CSP com `connect-src 'self'`: o navegador recusa qualquer requisição para fora do domínio, mesmo se um pacote for comprometido. Nenhum recurso de terceiro no cliente — sem analytics, sem fonte de CDN, sem pixel                   | `next.config.ts`                       |
| Vazamento por log                                           | O logger recusa por construção: nunca registra valor monetário, nome de conta, nome de categoria, rótulo ou texto digitado. Chaves sensíveis são substituídas por `[redacted]`. `console.log` é erro de lint                         | `src/lib/log.ts`, `eslint.config.mjs`  |
| Vazamento por dado real commitado numa fixture              | Toda fixture é sintética. `make audit-lgpd` falha o build se encontrar padrão de CPF/CNPJ                                                                                                                                            | `Makefile`, CI                         |
| XSS                                                         | React escapa por padrão; a CSP não permite `script-src` externo nem `object-src`. Nenhum uso de `dangerouslySetInnerHTML`                                                                                                            | `next.config.ts`                       |
| Clickjacking                                                | `frame-ancestors 'none'` e `X-Frame-Options: DENY`                                                                                                                                                                                   | `next.config.ts`                       |
| Vazamento de URL para terceiros                             | `Referrer-Policy: no-referrer` e `robots: noindex` no metadata                                                                                                                                                                       | `next.config.ts`, `src/app/layout.tsx` |
| Segredo no repositório                                      | `.env` e variantes no `.gitignore`; nenhum segredo é necessário nesta fase                                                                                                                                                           | `.gitignore`                           |
| **Acesso indevido de quem alcança a URL**                   | **Não mitigado nesta fase.** Não há autenticação. A mitigação é operacional: o ambiente é privado. A costura de sessão já existe e entrega `userId` em toda leitura, para que ligar autenticação na fase 2 não toque em nenhuma tela | `src/server/session.ts`, ADR-0008      |

**Em escopo** para um relato de segurança:

- Qualquer forma de fazer o navegador enviar dado da aplicação para uma origem externa.
- Qualquer caminho em que valor monetário ou texto digitado pela pessoa apareça em log.
- Qualquer XSS, injeção ou execução de conteúdo controlado pela pessoa.
- Cabeçalho de segurança ausente ou enfraquecido em relação ao que este documento afirma.
- Dado real encontrado em qualquer arquivo do repositório.
- Consulta de dado sem escopo de usuário.

**Fora de escopo** nesta fase:

- "Não tem login" — é decisão registrada, não vulnerabilidade. Ver ADR-0008.
- Falta de rate limiting, de 2FA, de auditoria de acesso — todos previstos para a fase 2.
- Vulnerabilidade em dependência de desenvolvimento que não chega ao bundle de produção.
- Ataque que exige acesso físico à máquina de desenvolvimento.

## Tratamento de dados em relatos

Relato, issue, PR e log de agente de IA seguem a mesma regra do resto do projeto: **nada de
dado real**. Isso inclui print de tela com valores, exportação de planilha, transcrição de
conversa e nome de instituição financeira associado a um saldo real. Se para explicar o
problema você precisa mostrar um número, invente o número.

## LGPD

| Item                | Situação                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dado tratado        | Lançamentos de receita e despesa, saldos por conta, bens, investimentos, dívidas e as datas dessas operações                                                                                     |
| Titular             | A pessoa usuária, única, dona da instância                                                                                                                                                       |
| Base legal prevista | Execução de contrato (art. 7º, V) para o funcionamento do produto; consentimento para qualquer uso além disso                                                                                    |
| Minimização         | Nenhum campo é coletado sem que uma tela o use. CPF, CNPJ, endereço e telefone **não** são coletados — o produto não precisa deles                                                               |
| Compartilhamento    | Nenhum. Não há terceiro no cliente nem no servidor                                                                                                                                               |
| Retenção            | Enquanto a instância existir; a exclusão é decisão do titular                                                                                                                                    |
| Direitos do titular | Acesso, correção, portabilidade e eliminação têm lugar previsto na modelagem (o dado já é escopado por `userId`). A implementação é da fase 2 e está registrada como pendência, não como omissão |
| Situação da fase 1  | **Nenhum dado de pessoa real é tratado.** Todas as fixtures são sintéticas                                                                                                                       |

Encarregado / contato para assuntos de proteção de dados: **llquadros95@gmail.com**.
