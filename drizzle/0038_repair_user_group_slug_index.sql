-- 0036 used an inline UNIQUE constraint for this column, while Drizzle's
-- schema expects the named index below. Keep existing databases consistent.
CREATE UNIQUE INDEX IF NOT EXISTS user_groups_slug_unique ON user_groups(slug);
