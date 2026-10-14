CREATE TABLE `payment_discrepancies` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`origin_kind` text NOT NULL,
	`origin_entry_id` text NOT NULL,
	`shortfall` integer NOT NULL,
	`origin_date` text NOT NULL,
	`status` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`,`origin_entry_id`) REFERENCES `entries`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payment_discrepancies_shortfall_positive" CHECK("payment_discrepancies"."shortfall" > 0)
);
--> statement-breakpoint
CREATE INDEX `payment_discrepancies_user_status_idx` ON `payment_discrepancies` (`user_id`,`status`,`origin_date`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_trace_events` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`origin_kind` text NOT NULL,
	`origin_liability_id` text,
	`origin_recurrence_id` text,
	`origin_entry_id` text,
	`description` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`,`origin_liability_id`) REFERENCES `liabilities`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`origin_recurrence_id`) REFERENCES `recurrences`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`origin_entry_id`) REFERENCES `entries`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "trace_events_origin_shape" CHECK(("__new_trace_events"."origin_kind" = 'Liability' AND "__new_trace_events"."origin_liability_id" IS NOT NULL
             AND "__new_trace_events"."origin_recurrence_id" IS NULL AND "__new_trace_events"."origin_entry_id" IS NULL)
          OR ("__new_trace_events"."origin_kind" = 'Recurrence' AND "__new_trace_events"."origin_recurrence_id" IS NOT NULL
             AND "__new_trace_events"."origin_liability_id" IS NULL AND "__new_trace_events"."origin_entry_id" IS NULL)
          OR ("__new_trace_events"."origin_kind" = 'Entry' AND "__new_trace_events"."origin_entry_id" IS NOT NULL
             AND "__new_trace_events"."origin_liability_id" IS NULL AND "__new_trace_events"."origin_recurrence_id" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_trace_events`("user_id", "id", "date", "kind", "origin_kind", "origin_liability_id", "origin_recurrence_id", "origin_entry_id", "description") SELECT "user_id", "id", "date", "kind", "origin_kind", "origin_liability_id", "origin_recurrence_id", NULL, "description" FROM `trace_events`;--> statement-breakpoint
DROP TABLE `trace_events`;--> statement-breakpoint
ALTER TABLE `__new_trace_events` RENAME TO `trace_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `trace_events_user_date_idx` ON `trace_events` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `trace_events_user_liability_idx` ON `trace_events` (`user_id`,`origin_liability_id`,`date`);