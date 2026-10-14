CREATE TABLE `open_finance_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`auto_sync` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
