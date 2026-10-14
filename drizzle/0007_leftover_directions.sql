CREATE TABLE `leftover_directions` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`month` text NOT NULL,
	`amount` integer NOT NULL,
	`destination_kind` text NOT NULL,
	`destination_bank_account_id` text,
	`destination_investment_id` text,
	`destination_liability_id` text,
	PRIMARY KEY(`user_id`, `id`),
	CONSTRAINT "leftover_directions_amount_positive" CHECK("leftover_directions"."amount" > 0)
);
