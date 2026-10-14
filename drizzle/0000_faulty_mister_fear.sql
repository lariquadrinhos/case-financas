CREATE TABLE `allocation_items` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`month` text NOT NULL,
	`bucket` text NOT NULL,
	`position` integer NOT NULL,
	`destination_kind` text,
	`destination_investment_id` text,
	`destination_bank_account_id` text,
	`destination_name` text,
	`amount` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`,`month`) REFERENCES `profit_allocations`(`user_id`,`month`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`destination_investment_id`) REFERENCES `investments`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`destination_bank_account_id`) REFERENCES `bank_accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "allocation_items_amount_non_negative" CHECK("allocation_items"."amount" >= 0),
	CONSTRAINT "allocation_items_destination_shape" CHECK("allocation_items"."destination_kind" IS NULL OR (
            ("allocation_items"."destination_kind" = 'Investment' AND "allocation_items"."destination_investment_id" IS NOT NULL
              AND "allocation_items"."destination_bank_account_id" IS NULL AND "allocation_items"."destination_name" IS NULL)
            OR ("allocation_items"."destination_kind" = 'BankAccount' AND "allocation_items"."destination_bank_account_id" IS NOT NULL
              AND "allocation_items"."destination_investment_id" IS NULL AND "allocation_items"."destination_name" IS NULL)
            OR ("allocation_items"."destination_kind" = 'FreeText' AND "allocation_items"."destination_name" IS NOT NULL
              AND "allocation_items"."destination_investment_id" IS NULL AND "allocation_items"."destination_bank_account_id" IS NULL)))
);
--> statement-breakpoint
CREATE INDEX `allocation_items_user_month_idx` ON `allocation_items` (`user_id`,`month`,`bucket`,`position`);--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`label` text NOT NULL,
	`colour` text NOT NULL,
	`entity` text NOT NULL,
	`balance` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `bank_accounts_user_entity_idx` ON `bank_accounts` (`user_id`,`entity`);--> statement-breakpoint
CREATE TABLE `categories` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`block_id` text NOT NULL,
	`name` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`suggested_classification` text,
	`archived` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`,`block_id`) REFERENCES `statement_blocks`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `categories_user_block_idx` ON `categories` (`user_id`,`block_id`);--> statement-breakpoint
CREATE INDEX `categories_user_archived_idx` ON `categories` (`user_id`,`archived`);--> statement-breakpoint
CREATE TABLE `discretionary_expenses` (
	`user_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`label` text,
	PRIMARY KEY(`user_id`, `entry_id`),
	FOREIGN KEY (`user_id`,`entry_id`) REFERENCES `entries`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `discretionary_spending_config` (
	`user_id` text PRIMARY KEY NOT NULL,
	`monthly_amount` integer NOT NULL,
	`source_account_id` text NOT NULL,
	`entity` text NOT NULL,
	FOREIGN KEY (`user_id`,`source_account_id`) REFERENCES `bank_accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "discretionary_config_amount_non_negative" CHECK("discretionary_spending_config"."monthly_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`recurrence_id` text,
	`entity` text,
	`category_id` text,
	`classification` text,
	`bank_account_id` text,
	`source_account_id` text,
	`destination_account_id` text,
	`direction` text,
	`label` text,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`category_id`) REFERENCES `categories`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`bank_account_id`) REFERENCES `bank_accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`source_account_id`) REFERENCES `bank_accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`destination_account_id`) REFERENCES `bank_accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`recurrence_id`) REFERENCES `recurrences`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "entries_expense_revenue_shape" CHECK("entries"."kind" NOT IN ('Expense', 'Revenue') OR (
            "entries"."entity" IS NOT NULL AND "entries"."category_id" IS NOT NULL
            AND "entries"."classification" IS NOT NULL AND "entries"."bank_account_id" IS NOT NULL
            AND "entries"."source_account_id" IS NULL AND "entries"."destination_account_id" IS NULL
            AND "entries"."direction" IS NULL AND "entries"."label" IS NULL)),
	CONSTRAINT "entries_intercompany_shape" CHECK("entries"."kind" NOT IN ('ProLabore', 'ProfitDistribution') OR (
            "entries"."source_account_id" IS NOT NULL AND "entries"."destination_account_id" IS NOT NULL
            AND "entries"."entity" IS NULL AND "entries"."category_id" IS NULL
            AND "entries"."classification" IS NULL AND "entries"."bank_account_id" IS NULL
            AND "entries"."direction" IS NULL AND "entries"."label" IS NULL)),
	CONSTRAINT "entries_income_tax_shape" CHECK("entries"."kind" <> 'IncomeTax' OR (
            "entries"."direction" IS NOT NULL AND "entries"."entity" IS NOT NULL
            AND "entries"."bank_account_id" IS NOT NULL
            AND "entries"."category_id" IS NULL AND "entries"."classification" IS NULL
            AND "entries"."source_account_id" IS NULL AND "entries"."destination_account_id" IS NULL)),
	CONSTRAINT "entries_date_format" CHECK("entries"."date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE INDEX `entries_user_date_idx` ON `entries` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `entries_user_status_date_idx` ON `entries` (`user_id`,`status`,`date`);--> statement-breakpoint
CREATE INDEX `entries_user_category_idx` ON `entries` (`user_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `entries_user_account_idx` ON `entries` (`user_id`,`bank_account_id`);--> statement-breakpoint
CREATE INDEX `entries_user_recurrence_idx` ON `entries` (`user_id`,`recurrence_id`);--> statement-breakpoint
CREATE TABLE `installments` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`liability_id` text NOT NULL,
	`number` integer NOT NULL,
	`planned_date` text NOT NULL,
	`planned_amount` integer NOT NULL,
	`status` text NOT NULL,
	`paid_amount` integer,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`,`liability_id`) REFERENCES `liabilities`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "installments_paid_amount_shape" CHECK(("installments"."status" = 'Paid') OR ("installments"."paid_amount" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `installments_user_liability_idx` ON `installments` (`user_id`,`liability_id`,`number`);--> statement-breakpoint
CREATE INDEX `installments_user_status_date_idx` ON `installments` (`user_id`,`status`,`planned_date`);--> statement-breakpoint
CREATE TABLE `investments` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`entity` text NOT NULL,
	`accumulated_value` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `investments_user_entity_idx` ON `investments` (`user_id`,`entity`);--> statement-breakpoint
CREATE TABLE `liabilities` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`creditor` text NOT NULL,
	`entity` text NOT NULL,
	`classification` text NOT NULL,
	`original_amount` integer NOT NULL,
	`installment_amount` integer NOT NULL,
	`installment_count` integer NOT NULL,
	`installments_already_paid` integer DEFAULT 0 NOT NULL,
	`monthly_interest_rate` real NOT NULL,
	`start_date` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "liabilities_count_positive" CHECK("liabilities"."installment_count" > 0),
	CONSTRAINT "liabilities_already_paid_in_range" CHECK("liabilities"."installments_already_paid" >= 0 AND "liabilities"."installments_already_paid" <= "liabilities"."installment_count"),
	CONSTRAINT "liabilities_rate_non_negative" CHECK("liabilities"."monthly_interest_rate" >= 0)
);
--> statement-breakpoint
CREATE INDEX `liabilities_user_entity_idx` ON `liabilities` (`user_id`,`entity`);--> statement-breakpoint
CREATE TABLE `occurrences` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`recurrence_id` text NOT NULL,
	`month` text NOT NULL,
	`planned_date` text NOT NULL,
	`planned_amount` integer,
	`status` text NOT NULL,
	`discarded` integer DEFAULT false NOT NULL,
	`entry_id` text,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`,`recurrence_id`) REFERENCES `recurrences`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`entry_id`) REFERENCES `entries`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "occurrences_month_format" CHECK("occurrences"."month" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "occurrences_paid_has_entry" CHECK(("occurrences"."status" = 'Paid') OR ("occurrences"."entry_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `occurrences_user_month_idx` ON `occurrences` (`user_id`,`month`);--> statement-breakpoint
CREATE INDEX `occurrences_user_recurrence_idx` ON `occurrences` (`user_id`,`recurrence_id`,`month`);--> statement-breakpoint
CREATE TABLE `pending_allocations` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`origin_kind` text NOT NULL,
	`origin_tangible_asset_id` text NOT NULL,
	`amount` integer NOT NULL,
	`origin_date` text NOT NULL,
	`status` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`,`origin_tangible_asset_id`) REFERENCES `tangible_assets`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `pending_allocations_user_status_idx` ON `pending_allocations` (`user_id`,`status`,`origin_date`);--> statement-breakpoint
CREATE TABLE `profit_allocations` (
	`user_id` text NOT NULL,
	`month` text NOT NULL,
	`net_profit` integer NOT NULL,
	PRIMARY KEY(`user_id`, `month`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "profit_allocations_month_format" CHECK("profit_allocations"."month" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE TABLE `rate_adjustments` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`liability_id` text NOT NULL,
	`new_rate` real NOT NULL,
	`effective_from` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`,`liability_id`) REFERENCES `liabilities`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "rate_adjustments_rate_non_negative" CHECK("rate_adjustments"."new_rate" >= 0)
);
--> statement-breakpoint
CREATE INDEX `rate_adjustments_user_liability_idx` ON `rate_adjustments` (`user_id`,`liability_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `recurrences` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`amount_kind` text NOT NULL,
	`start_date` text NOT NULL,
	`ends_on` text,
	`closed_on` text,
	`template_kind` text NOT NULL,
	`template_amount` integer,
	`template_entity` text,
	`template_category_id` text,
	`template_classification` text,
	`template_bank_account_id` text,
	`template_source_account_id` text,
	`template_destination_account_id` text,
	`template_direction` text,
	`template_label` text,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`template_category_id`) REFERENCES `categories`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`template_bank_account_id`) REFERENCES `bank_accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`template_source_account_id`) REFERENCES `bank_accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`template_destination_account_id`) REFERENCES `bank_accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "recurrences_template_categorized_shape" CHECK("recurrences"."template_kind" NOT IN ('Expense', 'Revenue') OR (
            "recurrences"."template_entity" IS NOT NULL AND "recurrences"."template_category_id" IS NOT NULL
            AND "recurrences"."template_classification" IS NOT NULL AND "recurrences"."template_bank_account_id" IS NOT NULL
            AND "recurrences"."template_source_account_id" IS NULL AND "recurrences"."template_destination_account_id" IS NULL
            AND "recurrences"."template_direction" IS NULL AND "recurrences"."template_label" IS NULL)),
	CONSTRAINT "recurrences_template_intercompany_shape" CHECK("recurrences"."template_kind" NOT IN ('ProLabore', 'ProfitDistribution') OR (
            "recurrences"."template_source_account_id" IS NOT NULL AND "recurrences"."template_destination_account_id" IS NOT NULL
            AND "recurrences"."template_entity" IS NULL AND "recurrences"."template_category_id" IS NULL
            AND "recurrences"."template_classification" IS NULL AND "recurrences"."template_bank_account_id" IS NULL
            AND "recurrences"."template_direction" IS NULL AND "recurrences"."template_label" IS NULL)),
	CONSTRAINT "recurrences_template_income_tax_shape" CHECK("recurrences"."template_kind" <> 'IncomeTax' OR (
            "recurrences"."template_direction" IS NOT NULL AND "recurrences"."template_entity" IS NOT NULL
            AND "recurrences"."template_bank_account_id" IS NOT NULL
            AND "recurrences"."template_category_id" IS NULL AND "recurrences"."template_classification" IS NULL
            AND "recurrences"."template_source_account_id" IS NULL AND "recurrences"."template_destination_account_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `recurrences_user_open_idx` ON `recurrences` (`user_id`,`closed_on`);--> statement-breakpoint
CREATE TABLE `statement_blocks` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`effect` text NOT NULL,
	`below_the_line` integer NOT NULL,
	`accepts_user_categories` integer NOT NULL,
	`statement_label` text,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `statement_blocks_user_order_idx` ON `statement_blocks` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `tangible_assets` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`entity` text NOT NULL,
	`recorded_value` integer NOT NULL,
	`sold_on` text,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `tangible_assets_user_sold_idx` ON `tangible_assets` (`user_id`,`sold_on`);--> statement-breakpoint
CREATE TABLE `trace_events` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`origin_kind` text NOT NULL,
	`origin_liability_id` text,
	`origin_recurrence_id` text,
	`description` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`,`origin_liability_id`) REFERENCES `liabilities`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`origin_recurrence_id`) REFERENCES `recurrences`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "trace_events_origin_shape" CHECK(("trace_events"."origin_kind" = 'Liability' AND "trace_events"."origin_liability_id" IS NOT NULL
             AND "trace_events"."origin_recurrence_id" IS NULL)
          OR ("trace_events"."origin_kind" = 'Recurrence' AND "trace_events"."origin_recurrence_id" IS NOT NULL
             AND "trace_events"."origin_liability_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `trace_events_user_date_idx` ON `trace_events` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `trace_events_user_liability_idx` ON `trace_events` (`user_id`,`origin_liability_id`,`date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
