CREATE TABLE `home_banners` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`image_url` text,
	`focus` text,
	`eyebrow` text,
	`title` text,
	`accent_title` text,
	`subtitle` text,
	`cta_label` text,
	`cta_href` text,
	`cta2_label` text,
	`cta2_href` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `home_banners_kind_idx` ON `home_banners` (`kind`,`sort_order`);