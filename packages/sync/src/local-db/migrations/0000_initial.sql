CREATE TABLE `facts` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`person_id` text,
	`union_id` text,
	`body` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `facts_tree_idx` ON `facts` (`tree_id`);--> statement-breakpoint
CREATE INDEX `facts_person_idx` ON `facts` (`person_id`);--> statement-breakpoint
CREATE INDEX `facts_union_idx` ON `facts` (`union_id`);--> statement-breakpoint
CREATE TABLE `filiations` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`parent_id` text NOT NULL,
	`child_id` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `filiations_tree_idx` ON `filiations` (`tree_id`);--> statement-breakpoint
CREATE INDEX `filiations_parent_idx` ON `filiations` (`parent_id`);--> statement-breakpoint
CREATE INDEX `filiations_child_idx` ON `filiations` (`child_id`);--> statement-breakpoint
CREATE TABLE `multiple_births` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `multiple_births_tree_idx` ON `multiple_births` (`tree_id`);--> statement-breakpoint
CREATE TABLE `names` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`person_id` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `names_tree_idx` ON `names` (`tree_id`);--> statement-breakpoint
CREATE INDEX `names_person_idx` ON `names` (`person_id`);--> statement-breakpoint
CREATE TABLE `parent_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`child_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `parent_candidates_tree_idx` ON `parent_candidates` (`tree_id`);--> statement-breakpoint
CREATE INDEX `parent_candidates_child_idx` ON `parent_candidates` (`child_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `people_tree_idx` ON `people` (`tree_id`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `places_tree_idx` ON `places` (`tree_id`);--> statement-breakpoint
CREATE TABLE `simultaneity_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`union_a_id` text NOT NULL,
	`union_b_id` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `simultaneity_answers_tree_idx` ON `simultaneity_answers` (`tree_id`);--> statement-breakpoint
CREATE TABLE `title_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`person_id` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `title_roles_tree_idx` ON `title_roles` (`tree_id`);--> statement-breakpoint
CREATE INDEX `title_roles_person_idx` ON `title_roles` (`person_id`);--> statement-breakpoint
CREATE TABLE `to_place` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`person_id` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `to_place_tree_idx` ON `to_place` (`tree_id`);--> statement-breakpoint
CREATE TABLE `trees` (
	`id` text PRIMARY KEY NOT NULL,
	`reader_account_id` text NOT NULL,
	`loaded_at` integer NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `unions` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`spouse_a_id` text NOT NULL,
	`spouse_b_id` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `unions_tree_idx` ON `unions` (`tree_id`);--> statement-breakpoint
CREATE INDEX `unions_spouse_a_idx` ON `unions` (`spouse_a_id`);--> statement-breakpoint
CREATE INDEX `unions_spouse_b_idx` ON `unions` (`spouse_b_id`);