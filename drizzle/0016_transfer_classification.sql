ALTER TABLE `imported_transactions` ADD `transfer_kind` text;--> statement-breakpoint
ALTER TABLE `imported_transactions` ADD `counterpart_transaction_id` text;--> statement-breakpoint
ALTER TABLE `imported_transactions` ADD `from_bank_account_id` text;--> statement-breakpoint
ALTER TABLE `imported_transactions` ADD `to_bank_account_id` text;