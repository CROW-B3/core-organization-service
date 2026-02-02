-- Remove slug column from organization table
DROP INDEX IF EXISTS `organization_slug_unique`;
--> statement-breakpoint
CREATE TABLE `organization_new` (
	`id` text PRIMARY KEY NOT NULL,
	`betterAuthOrgId` text NOT NULL,
	`name` text NOT NULL,
	`logo` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `organization_new` SELECT `id`, `betterAuthOrgId`, `name`, `logo`, `createdAt`, `updatedAt` FROM `organization`;
--> statement-breakpoint
DROP TABLE `organization`;
--> statement-breakpoint
ALTER TABLE `organization_new` RENAME TO `organization`;
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_betterAuthOrgId_unique` ON `organization` (`betterAuthOrgId`);
