CREATE TABLE `net_worth_snapshots` (
	`user_id` text NOT NULL,
	`month` text NOT NULL,
	`view` text NOT NULL,
	`net_worth` integer NOT NULL,
	`recorded_on` text NOT NULL,
	PRIMARY KEY(`user_id`, `month`, `view`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
