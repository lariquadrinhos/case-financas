# Spec — SDD (Spec-Driven Development)

Dev e Design planejam, implementam e verificam suas soluções em ciclos curtos. O loop de desenvolvimento é onde o produto é realmente feito — a qualidade dele depende do tamanho das tarefas.

## Princípios

- **Tarefas pequenas > tarefas grandes.** Quanto menor a tarefa, maior a garantia de assertividade a cada ciclo de plano → implementação → verificação.
- **Trabalho em grupo, criatividade individual.** O grupo alinha direção; a execução de cada tarefa é individual, para não diluir a criatividade em comitê.
- **Respeite o limite cognitivo humano.** A capacidade de retenção humana é inferior à de uma máquina — não acumule escopo além do que cabe na cabeça de quem implementa. Se uma tarefa exige lembrar de mais de um punhado de coisas ao mesmo tempo, ela está grande demais.
- **Separe criação de verificação.** Sempre que possível, quem verifica não é quem criou — evita "comprehension debt" (dívida de compreensão: código/artefato que ninguém entende de fato porque foi só aceito).
- **Automatize para acelerar o que você entende, não para evitar pensar.** Loops e automações (agendamentos, worktrees paralelos, sub-agentes de verificação) servem para ganhar velocidade sobre trabalho que a pessoa já compreende — nunca como forma de terceirizar o entendimento em si.
- **Memória externa.** Decisões e contexto de cada ciclo devem ficar registrados fora da cabeça de quem trabalhou (ADR, spec, notas) — o ciclo seguinte não deve depender de lembrança.

## Constitution — pré-requisito da spec

Antes de escrever a primeira spec do projeto (ou de um módulo novo), registre uma **Constitution**: o documento que codifica o DNA do projeto — padrões, convenções e princípios arquiteturais que orientam tanto quem implementa quanto qualquer agente de IA atuando no código. Ela não substitui a ADR (que registra uma decisão pontual); a Constitution é o pano de fundo estável contra o qual as specs e ADRs são escritas.

- Exige julgamento sênior — não é algo que se gera automaticamente a partir do código. Precisa codificar intenção arquitetural real, regras de nomenclatura, política de dependências e o racional por trás de padrões existentes.
- É viva: revise-a quando uma ADR estabelecer um precedente novo que deveria valer para todo o projeto, não só para a decisão pontual.
- Sem Constitution, cada spec reinventa convenções — o sintoma mais comum é PRs consistentes internamente, mas inconsistentes entre si.
- Fica em `/docs/constitution.md`, na raiz do repositório — arquivo único, editado in-place conforme o projeto evolui.

## Ciclo por tarefa

1. **Specify** — descreva o comportamento desejado (o "o quê"), com os unknowns resolvidos antes de começar (`references/perguntas.md`).
2. **Plan** — traduza a spec em um plano técnico mínimo, à luz da Constitution.
3. **Tasks** — quebre o plano em tarefas pequenas o suficiente para caber no limite cognitivo de quem implementa.
4. **Implement** — uma tarefa pequena por vez.
5. **Verificar** — de preferência por outra pessoa/papel; validar contra a spec, a ADR que a originou e, em brownfield, contra os testes existentes.

Nenhuma tarefa é considerada concluída sem passar pela verificação — isso alimenta diretamente a etapa de Revisão (`references/revisao.md`). SDD não é automação ponta a ponta: cada fase exige atenção e expertise humana específica; não trate o ciclo como algo que roda sozinho.

## Green field vs. brown field na spec

Assim como no Event Storming (`references/event-storming.md`), o terreno muda a abordagem.

**Green field** — a spec pode (e deve) cobrir o sistema/módulo de ponta a ponta, porque não há comportamento legado a proteger.

**Brown field** — a maior parte deste projeto, à medida que evolui, vai cair aqui. Cinco riscos concretos a vigiar:

1. **Escala** — codebases grandes tornam specs abrangentes impossíveis de revisar de verdade. Não tente especificar o sistema inteiro.
2. **Conhecimento tribal** — quem decidiu a arquitetura original pode não estar mais no time; a documentação pode não existir. Trate isso como um "unknown known" a ser confirmado, não assumido.
3. **Dependências ocultas** — relações entre módulos acumuladas ao longo do tempo raramente estão documentadas.
4. **Contratos implícitos** — expectativas de comportamento entre componentes que nunca foram formalizadas.
5. **Saúde do código existente** — código de baixa qualidade concentra risco de defeito; não presuma que a área que você vai tocar está saudável só porque está em produção.

Por isso, em brownfield:

- **Pesquise antes de especificar.** Peça (ou faça) um levantamento do código existente — arquitetura, módulos, fluxos de dados, padrões — e registre em um documento de pesquisa curto. Trate o código como fonte de verdade, não o README desatualizado.
- **Escreva specs de escopo restrito (change-level), não de sistema inteiro.** Descreva apenas o delta: comportamento atual, comportamento alvo, invariantes que não podem quebrar, limites do que não está sendo tocado.
- **Escolha o padrão de spec pelo tamanho da mudança:**
  - _Change spec_ — uma correção, feature ou refatoração pontual.
  - _Boundary spec_ — quando a mudança extrai/decompõe um serviço; formaliza o contrato de integração.
  - _Migration spec_ — modernização em múltiplas fases, cada etapa independentemente implantável.
- **Respeite a decomposição arquitetural existente.** Desviar da estrutura atual sem passar por uma ADR cria débito de manutenção — se a mudança exige desviar, isso é uma decisão arquitetural, não um detalhe de implementação.
- **Execução paralela isolada.** Use worktrees para trabalho concorrente em áreas diferentes do mesmo codebase, mantendo o contexto (Constitution, specs relevantes) compartilhado entre elas.
- **Verificação dupla.** Valide contra a spec **e** contra os testes existentes — o objetivo em brownfield não é só "a mudança funciona", é "o comportamento legado não quebrou".
- **Sempre precisa de alguém que entenda a arquitetura existente revisando o mapa de dependências.** Automação apoia, não substitui esse julgamento.

## Onde fica

`/docs/specs/<slug>/`, uma pasta por spec, na raiz do repositório:

```
/docs/specs/<slug>/
  spec.md    # Specify — o comportamento desejado
  plan.md    # Plan — o plano técnico
  tasks.md   # Tasks — a quebra em tarefas pequenas
```

O `<slug>` identifica a mudança (ex.: `docs/specs/checkout-parcelado/`). Em brownfield, é aqui também que fica o documento curto de pesquisa do código existente, se for produzido separadamente (`docs/specs/<slug>/research.md`).
