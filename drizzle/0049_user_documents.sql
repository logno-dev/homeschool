CREATE TABLE `user_documents` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `family_id` text REFERENCES `families`(`id`) ON DELETE SET NULL,
  `filename` text NOT NULL,
  `document_type` text NOT NULL,
  `blob_url` text NOT NULL,
  `pathname` text NOT NULL,
  `size` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
