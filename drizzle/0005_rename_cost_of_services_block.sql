-- Os 10 blocos do DRE são dado de REFERÊNCIA, não dado da pessoa: não existe
-- rota que renomeie um bloco (`/api/v1/statement-blocks` é somente leitura) e
-- `StatementBlockWriter.seed` só roda quando a tabela está vazia
-- (src/features/onboarding/seed-chart.ts). Logo uma base já semeada guardaria
-- para sempre o rótulo antigo, e a correção precisa vir por migração.
--
-- Bloco 3: a sigla "(CSV)" é abreviação de prosa do PRD (§361); nenhum frame
-- do Figma a imprime. Com os dois rótulos iguais, o bloco deixa de precisar de
-- `statement_label`.
UPDATE statement_blocks
SET name = 'Custo dos Serviços/Produtos',
    statement_label = NULL
WHERE id = 'custo-dos-servicos';
