ALTER TABLE `oralReadings` ADD `retentionDays` int DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE `oralReadings` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `passages` ADD `retentionDays` int DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE `passages` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `readingSessions` ADD `retentionDays` int DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE `readingSessions` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `students` ADD `retentionDays` int DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `expiresAt` timestamp;