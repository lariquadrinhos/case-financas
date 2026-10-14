# Event Storming / DDD

Toda mudança que sai do PRD passa por Event Storming antes de virar ADR: mapear eventos e atores primeiro produz ADRs mais concisas e assertivas, porque a decisão arquitetural nasce de um modelo de domínio explícito, não de intuição.

Conduzido pelo time de desenvolvimento (Design participa quando a mudança toca experiência do usuário).

## Green field vs. brown field

O terreno muda a abordagem — não trate os dois da mesma forma:

- **Green field** (nada existe ainda): explore amplamente antes de convergir. Perguntas exploratórias e de Starbursting (quem, o quê, quando, como) para desenhar o domínio do zero. O risco aqui é convergir cedo demais.
- **Brown field** (já existe sistema/domínio): mapeie o que já existe antes de propor mudança. Perguntas investigativas e conectivas para entender dependências e comportamento atual antes de alterar. O risco aqui é assumir que se sabe como o sistema atual funciona sem confirmar (unknown known clássico).

## Condução

1. Identifique os eventos de domínio relevantes (o que acontece, no passado — "pedido criado", não "criar pedido").
2. Identifique os atores/comandos que disparam cada evento.
3. Identifique problemas e soluções candidatas a partir do fluxo de eventos mapeado.
4. Faça perguntas com intenção (`references/perguntas.md`) em cada ponto de ambiguidade — não avance o mapa sobre uma suposição não confirmada.
5. O resultado alimenta diretamente a ADR: problema, contexto e evidência de por que a decisão é necessária.
