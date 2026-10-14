PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_entries` (
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
	CONSTRAINT "entries_expense_revenue_shape" CHECK("__new_entries"."kind" NOT IN ('Expense', 'Revenue') OR (
            "__new_entries"."entity" IS NOT NULL AND "__new_entries"."category_id" IS NOT NULL
            AND "__new_entries"."classification" IS NOT NULL AND "__new_entries"."bank_account_id" IS NOT NULL
            AND "__new_entries"."source_account_id" IS NULL AND "__new_entries"."destination_account_id" IS NULL
            AND "__new_entries"."direction" IS NULL AND "__new_entries"."label" IS NULL)),
	CONSTRAINT "entries_intercompany_shape" CHECK("__new_entries"."kind" NOT IN ('ProLabore', 'ProfitDistribution') OR (
            "__new_entries"."destination_account_id" IS NOT NULL
            AND "__new_entries"."entity" IS NULL AND "__new_entries"."category_id" IS NULL
            AND "__new_entries"."classification" IS NULL AND "__new_entries"."bank_account_id" IS NULL
            AND "__new_entries"."direction" IS NULL AND "__new_entries"."label" IS NULL)),
	CONSTRAINT "entries_income_tax_shape" CHECK("__new_entries"."kind" <> 'IncomeTax' OR (
            "__new_entries"."direction" IS NOT NULL AND "__new_entries"."entity" IS NOT NULL
            AND "__new_entries"."bank_account_id" IS NOT NULL
            AND "__new_entries"."category_id" IS NULL AND "__new_entries"."classification" IS NULL
            AND "__new_entries"."source_account_id" IS NULL AND "__new_entries"."destination_account_id" IS NULL)),
	CONSTRAINT "entries_date_format" CHECK("__new_entries"."date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
INSERT INTO `__new_entries`("user_id", "id", "kind", "amount", "date", "status", "recurrence_id", "entity", "category_id", "classification", "bank_account_id", "source_account_id", "destination_account_id", "direction", "label") SELECT "user_id", "id", "kind", "amount", "date", "status", "recurrence_id", "entity", "category_id", "classification", "bank_account_id", "source_account_id", "destination_account_id", "direction", "label" FROM `entries`;--> statement-breakpoint
DROP TABLE `entries`;--> statement-breakpoint
ALTER TABLE `__new_entries` RENAME TO `entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `entries_user_date_idx` ON `entries` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `entries_user_status_date_idx` ON `entries` (`user_id`,`status`,`date`);--> statement-breakpoint
CREATE INDEX `entries_user_category_idx` ON `entries` (`user_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `entries_user_account_idx` ON `entries` (`user_id`,`bank_account_id`);--> statement-breakpoint
CREATE INDEX `entries_user_recurrence_idx` ON `entries` (`user_id`,`recurrence_id`);--> statement-breakpoint
CREATE TABLE `__new_recurrences` (
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
	CONSTRAINT "recurrences_template_categorized_shape" CHECK("__new_recurrences"."template_kind" NOT IN ('Expense', 'Revenue') OR (
            "__new_recurrences"."template_entity" IS NOT NULL AND "__new_recurrences"."template_category_id" IS NOT NULL
            AND "__new_recurrences"."template_classification" IS NOT NULL AND "__new_recurrences"."template_bank_account_id" IS NOT NULL
            AND "__new_recurrences"."template_source_account_id" IS NULL AND "__new_recurrences"."template_destination_account_id" IS NULL
            AND "__new_recurrences"."template_direction" IS NULL AND "__new_recurrences"."template_label" IS NULL)),
	CONSTRAINT "recurrences_template_intercompany_shape" CHECK("__new_recurrences"."template_kind" NOT IN ('ProLabore', 'ProfitDistribution') OR (
            "__new_recurrences"."template_destination_account_id" IS NOT NULL
            AND "__new_recurrences"."template_entity" IS NULL AND "__new_recurrences"."template_category_id" IS NULL
            AND "__new_recurrences"."template_classification" IS NULL AND "__new_recurrences"."template_bank_account_id" IS NULL
            AND "__new_recurrences"."template_direction" IS NULL AND "__new_recurrences"."template_label" IS NULL)),
	CONSTRAINT "recurrences_template_income_tax_shape" CHECK("__new_recurrences"."template_kind" <> 'IncomeTax' OR (
            "__new_recurrences"."template_direction" IS NOT NULL AND "__new_recurrences"."template_entity" IS NOT NULL
            AND "__new_recurrences"."template_bank_account_id" IS NOT NULL
            AND "__new_recurrences"."template_category_id" IS NULL AND "__new_recurrences"."template_classification" IS NULL
            AND "__new_recurrences"."template_source_account_id" IS NULL AND "__new_recurrences"."template_destination_account_id" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_recurrences`("user_id", "id", "amount_kind", "start_date", "ends_on", "closed_on", "template_kind", "template_amount", "template_entity", "template_category_id", "template_classification", "template_bank_account_id", "template_source_account_id", "template_destination_account_id", "template_direction", "template_label") SELECT "user_id", "id", "amount_kind", "start_date", "ends_on", "closed_on", "template_kind", "template_amount", "template_entity", "template_category_id", "template_classification", "template_bank_account_id", "template_source_account_id", "template_destination_account_id", "template_direction", "template_label" FROM `recurrences`;--> statement-breakpoint
DROP TABLE `recurrences`;--> statement-breakpoint
ALTER TABLE `__new_recurrences` RENAME TO `recurrences`;--> statement-breakpoint
CREATE INDEX `recurrences_user_open_idx` ON `recurrences` (`user_id`,`closed_on`);