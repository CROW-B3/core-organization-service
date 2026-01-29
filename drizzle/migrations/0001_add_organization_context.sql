CREATE TABLE `organization_context` (
  `id` text PRIMARY KEY NOT NULL,
  `organizationId` text NOT NULL,
  `crawlId` text NOT NULL,
  `contextType` text DEFAULT 'ai_generated_summary' NOT NULL,
  `structuredData` text NOT NULL,
  `generatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_organization_context_orgId` ON `organization_context` (`organizationId`);
--> statement-breakpoint
CREATE INDEX `idx_organization_context_crawlId` ON `organization_context` (`crawlId`);
