CREATE TABLE `imported_transactions` (
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`account_id` text NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text NOT NULL,
	`outcome` text NOT NULL,
	`entry_id` text,
	`settled_on` text,
	PRIMARY KEY(`user_id`, `transaction_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "imported_transactions_amount_non_negative" CHECK("imported_transactions"."amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX `imported_transactions_user_outcome_idx` ON `imported_transactions` (`user_id`,`outcome`,`settled_on`);--> statement-breakpoint
CREATE TABLE `open_finance_links` (
	`user_id` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_bank_account_id` text,
	`target_investment_id` text,
	`linked_on` text NOT NULL,
	PRIMARY KEY(`user_id`, `provider_account_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`target_bank_account_id`) REFERENCES `bank_accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`,`target_investment_id`) REFERENCES `investments`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "open_finance_links_target_shape" CHECK(("open_finance_links"."target_kind" = 'Investment' AND "open_finance_links"."target_investment_id" IS NOT NULL AND "open_finance_links"."target_bank_account_id" IS NULL) OR ("open_finance_links"."target_kind" <> 'Investment' AND "open_finance_links"."target_bank_account_id" IS NOT NULL AND "open_finance_links"."target_investment_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE `open_finance_sync_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_synced_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
