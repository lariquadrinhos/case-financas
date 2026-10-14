ALTER TABLE `imported_transactions` ADD `provider_category` text;--> statement-breakpoint
ALTER TABLE `imported_transactions` ADD `categorized_by_person` integer DEFAULT false NOT NULL;