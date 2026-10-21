CREATE TABLE `mutation_queue` (
	`seq` integer PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`batch_id` text NOT NULL,
	`tree_id` text NOT NULL,
	`author_account_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`status` text NOT NULL,
	`refusal_code` text,
	`body` text NOT NULL,
	CONSTRAINT "mutation_queue_status_check" CHECK("mutation_queue"."status" IN ('pending', 'sent', 'refused')),
	CONSTRAINT "mutation_queue_refusal_check" CHECK(("mutation_queue"."status" = 'refused') = ("mutation_queue"."refusal_code" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mutation_queue_id_unique` ON `mutation_queue` (`id`);--> statement-breakpoint
CREATE INDEX `mutation_queue_tree_idx` ON `mutation_queue` (`tree_id`);--> statement-breakpoint
CREATE INDEX `mutation_queue_batch_idx` ON `mutation_queue` (`batch_id`);--> statement-breakpoint
CREATE INDEX `mutation_queue_entity_idx` ON `mutation_queue` (`entity_id`);