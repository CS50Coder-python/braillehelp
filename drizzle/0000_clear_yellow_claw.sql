CREATE TABLE `brailleAnalyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`passageId` int NOT NULL,
	`ownerUserId` int,
	`detectedText` text NOT NULL,
	`confidence` float NOT NULL,
	`brailleStandard` varchar(120) NOT NULL,
	`warnings` text,
	`cellCount` int NOT NULL,
	`lineCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brailleAnalyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `passages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int,
	`title` varchar(255) NOT NULL,
	`sourceFileKey` varchar(512),
	`sourceMimeType` varchar(80),
	`detectedText` text,
	`expectedWordCount` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `readingSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int,
	`passageId` int,
	`status` enum('ready','running','completed','cancelled') NOT NULL DEFAULT 'ready',
	`startedAt` timestamp,
	`completedAt` timestamp,
	`elapsedMs` int NOT NULL DEFAULT 0,
	`readingSpeedWpm` float NOT NULL DEFAULT 0,
	`rereads` int NOT NULL DEFAULT 0,
	`skippedRegions` int NOT NULL DEFAULT 0,
	`pauseCount` int NOT NULL DEFAULT 0,
	`trackingCoverage` float NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `readingSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trackingEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`eventType` enum('finger_move','pause','reread','skip','line_change') NOT NULL,
	`timestampMs` int NOT NULL,
	`lineIndex` int NOT NULL DEFAULT 0,
	`regionIndex` int NOT NULL DEFAULT 0,
	`x` float,
	`y` float,
	`confidence` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trackingEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
