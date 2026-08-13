CREATE TABLE `oralReadings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`ownerUserId` int,
	`audioFileKey` varchar(512),
	`audioMimeType` varchar(80),
	`transcript` text NOT NULL,
	`expectedText` text NOT NULL,
	`matchScore` float NOT NULL,
	`mismatches` text,
	`language` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oralReadings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `readingSessions` ADD `calibrationVersion` varchar(40);--> statement-breakpoint
ALTER TABLE `readingSessions` ADD `calibrationHeight` float;--> statement-breakpoint
ALTER TABLE `readingSessions` ADD `calibrationConfidence` float;--> statement-breakpoint
ALTER TABLE `readingSessions` ADD `consentCamera` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `readingSessions` ADD `consentAudio` int DEFAULT 0 NOT NULL;