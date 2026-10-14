CREATE TABLE `onboarding_progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`last_step` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "onboarding_last_step_in_range" CHECK("onboarding_progress"."last_step" IS NULL OR ("onboarding_progress"."last_step" >= 1 AND "onboarding_progress"."last_step" <= 5))
);
--> statement-breakpoint
-- Backfill: quem JÁ tem patrimônio cadastrado neste banco chegou aqui pela
-- regra antiga de `src/app/page.tsx` (zero linha em bank_accounts,
-- tangible_assets, investments e liabilities = "sem dados"), que nunca gravou
-- os eventos que o Wireframe desenha ("Fazer depois" 116:11, "Salvar e
-- continuar depois" 29:36, "Concluir" 29:235). Sem esta linha, a primeira
-- abertura do app depois da migração mandaria essas pessoas de volta pro
-- Onboarding 0 — o oposto do que files_design/01 §1 promete a quem já
-- configurou. Aplica-se uma vez, e só a quem a regra antiga já mandava pra Home.
INSERT INTO `onboarding_progress` (`user_id`, `status`, `last_step`)
SELECT `id`, 'Completed', 5 FROM `users` u
WHERE EXISTS (SELECT 1 FROM `bank_accounts` t WHERE t.`user_id` = u.`id`)
   OR EXISTS (SELECT 1 FROM `tangible_assets` t WHERE t.`user_id` = u.`id`)
   OR EXISTS (SELECT 1 FROM `investments` t WHERE t.`user_id` = u.`id`)
   OR EXISTS (SELECT 1 FROM `liabilities` t WHERE t.`user_id` = u.`id`);
