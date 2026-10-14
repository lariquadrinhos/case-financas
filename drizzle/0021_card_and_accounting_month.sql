ALTER TABLE `entries` ADD `is_credit_card` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `entries` ADD `accounting_month` text;--> statement-breakpoint
CREATE INDEX `entries_user_accounting_month_idx` ON `entries` (`user_id`,`accounting_month`);--> statement-breakpoint
ALTER TABLE `recurrences` ADD `template_is_credit_card` integer DEFAULT false NOT NULL;