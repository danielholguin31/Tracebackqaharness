CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step` integer NOT NULL,
	`timestamp` text NOT NULL,
	`thought` text NOT NULL,
	`action` text NOT NULL,
	`is_error` integer DEFAULT false NOT NULL,
	`screenshot_url` text
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`summary` text NOT NULL,
	`pr_number` text,
	`branch` text,
	`pr_url` text,
	`initiated_at` text NOT NULL,
	`completed_at` text,
	`duration` real,
	`status` text DEFAULT 'pass' NOT NULL,
	`result_json` text DEFAULT '{"passed":0,"failed":0}' NOT NULL,
	`test_ids_json` text DEFAULT '[]' NOT NULL,
	`run_ids_json` text DEFAULT '[]' NOT NULL,
	`issue_ids_json` text DEFAULT '[]' NOT NULL,
	`raw_payload_json` text,
	`agent_response` text
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`github_json` text DEFAULT '{"installed":false,"repos":[]}' NOT NULL,
	`linear_json` text DEFAULT '{"installed":false}' NOT NULL,
	`jira_json` text DEFAULT '{"installed":false}' NOT NULL,
	`slack_json` text DEFAULT '{"installed":false}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integrations_workspace_id_unique` ON `integrations` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `issues` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`run_id` text NOT NULL,
	`test_id` text NOT NULL,
	`title` text NOT NULL,
	`severity` text DEFAULT 'high' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`flow` text NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`proposed_solution` text,
	`agent_note` text,
	`screenshots_json` text DEFAULT '[]' NOT NULL,
	`triggered_by` text DEFAULT 'manual' NOT NULL,
	`event_id` text,
	`external_ref_json` text,
	`dismiss_reason` text,
	`resolved_at` text,
	`pushed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operator_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`from_user_id` text,
	`components_json` text,
	`reasoning_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operator_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text DEFAULT 'New Chat' NOT NULL,
	`participants_json` text DEFAULT '[]' NOT NULL,
	`page_label` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operator_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`autonomy_preset` text DEFAULT 'balanced' NOT NULL,
	`response_format` integer DEFAULT 50 NOT NULL,
	`mockup_freq` integer DEFAULT 50 NOT NULL,
	`response_length` integer DEFAULT 50 NOT NULL,
	`model` text DEFAULT 'gpt-4o-mini' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`always_do` text DEFAULT '' NOT NULL,
	`never_do` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operator_settings_workspace_id_unique` ON `operator_settings` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `operator_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`trigger` text NOT NULL,
	`instruction` text NOT NULL,
	`is_builtin` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personal_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`color` text DEFAULT '#7B8FC2' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`last_active_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`type` text NOT NULL,
	`format` text DEFAULT 'ui' NOT NULL,
	`status` text DEFAULT 'generating' NOT NULL,
	`custom_prompt` text,
	`generated_at` text,
	`download_url` text
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`test_id` text NOT NULL,
	`test_name` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`environment` text DEFAULT 'staging' NOT NULL,
	`viewport` text DEFAULT 'desktop' NOT NULL,
	`runner_mode` text DEFAULT 'standard' NOT NULL,
	`triggered_by` text DEFAULT 'manual' NOT NULL,
	`triggered_by_user` text,
	`branch` text,
	`commit` text,
	`duration` real,
	`credits` integer,
	`started_at` text NOT NULL,
	`completed_at` text,
	`key_finding` text,
	`screenshot_count` integer DEFAULT 0 NOT NULL,
	`issue_count` integer DEFAULT 0 NOT NULL,
	`video_url` text,
	`suite_run_id` text
);
--> statement-breakpoint
CREATE TABLE `suite_run_results` (
	`id` text PRIMARY KEY NOT NULL,
	`suite_run_id` text NOT NULL,
	`test_id` text NOT NULL,
	`test_name` text NOT NULL,
	`run_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`duration` real,
	`issue_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `suite_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`suite_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`triggered_by` text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `suites` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`name` text NOT NULL,
	`test_ids_json` text DEFAULT '[]' NOT NULL,
	`triggers_json` text DEFAULT '{"onPr":false,"onDeploy":false,"scheduled":false}' NOT NULL,
	`parallel` integer DEFAULT false NOT NULL,
	`max_concurrency` integer,
	`retry_failed_tests` text DEFAULT 'none' NOT NULL,
	`status` text DEFAULT 'never_run' NOT NULL,
	`last_run_at` text,
	`last_run_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `test_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`order` integer NOT NULL,
	`action` text NOT NULL,
	`is_ai_generated` integer DEFAULT false NOT NULL,
	`generated_action` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'click' NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`css` integer DEFAULT false NOT NULL,
	`stable` integer DEFAULT true NOT NULL,
	`press_enter` integer DEFAULT false NOT NULL,
	`capture_screenshot` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tests` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`name` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'never_run' NOT NULL,
	`environment` text DEFAULT 'staging' NOT NULL,
	`entry_point` text DEFAULT '' NOT NULL,
	`auth` text DEFAULT '' NOT NULL,
	`runner_mode` text DEFAULT 'standard' NOT NULL,
	`viewport_json` text DEFAULT '{"mode":"single","single":"desktop"}' NOT NULL,
	`triggers_json` text DEFAULT '{"onPr":false,"onDeploy":false,"scheduled":false}' NOT NULL,
	`suite_ids_json` text DEFAULT '[]' NOT NULL,
	`default_reports_json` text DEFAULT '["standard"]' NOT NULL,
	`custom_prompt` text,
	`estimated_credits` integer,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`self_healing` integer DEFAULT false NOT NULL,
	`self_healing_sensitivity` text DEFAULT 'medium' NOT NULL,
	`screenshot_on_failure` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`last_run_at` text,
	`last_run_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `toolbox_auth` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`oauth_provider` text,
	`cookie_string` text
);
--> statement-breakpoint
CREATE TABLE `toolbox_browser` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`headless` integer DEFAULT true NOT NULL,
	`slow_mo` integer DEFAULT 0 NOT NULL,
	`timeout` integer DEFAULT 30000 NOT NULL,
	`screenshots` text DEFAULT 'on-failure' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `toolbox_browser_workspace_id_unique` ON `toolbox_browser` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `toolbox_mcp` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`auth_token` text,
	`status` text DEFAULT 'disconnected' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `toolbox_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`initials` text NOT NULL,
	`color` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`plan_type` text DEFAULT 'free' NOT NULL,
	`credits_remaining` integer DEFAULT 1000 NOT NULL,
	`credits_total` integer DEFAULT 1000 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unique` ON `workspaces` (`slug`);