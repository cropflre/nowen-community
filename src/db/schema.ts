import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const now = sql`(unixepoch())`;

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['member', 'moderator', 'admin'] }).notNull().default('member'),
  state: text('state', { enum: ['active', 'suspended'] }).notNull().default('active'),
  avatarKey: text('avatar_key'),
  createdAt: integer('created_at').notNull().default(now),
}, t => [uniqueIndex('users_username_unique').on(t.username)]);

export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey(),
  codeHash: text('code_hash').notNull().unique(),
  createdBy: text('created_by').references(() => users.id),
  usedBy: text('used_by').references(() => users.id),
  expiresAt: integer('expires_at'),
  usedAt: integer('used_at'),
  createdAt: integer('created_at').notNull().default(now),
});

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull().default(now),
}, t => [index('sessions_user_idx').on(t.userId)]);

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  icon: text('icon').notNull().default('messages-square'),
  sort: integer('sort').notNull().default(0),
  createdAt: integer('created_at').notNull().default(now),
});

export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  authorId: text('author_id').notNull().references(() => users.id),
  clientKey: text('client_key'),
  title: text('title').notNull(),
  content: text('content').notNull(),
  status: text('status', { enum: ['draft', 'pending', 'published', 'hidden'] }).notNull().default('pending'),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  replyCount: integer('reply_count').notNull().default(0),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, t => [index('topics_feed_idx').on(t.status, t.createdAt), index('topics_category_idx').on(t.categoryId, t.status, t.createdAt)]);

export const replies = sqliteTable('replies', {
  id: text('id').primaryKey(),
  topicId: text('topic_id').notNull().references(() => topics.id),
  authorId: text('author_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  clientKey: text('client_key'),
  status: text('status', { enum: ['pending', 'published', 'hidden'] }).notNull().default('pending'),
  createdAt: integer('created_at').notNull().default(now),
}, t => [index('replies_topic_idx').on(t.topicId, t.status, t.createdAt)]);

export const topicLikes = sqliteTable('topic_likes', {
  topicId: text('topic_id').notNull().references(() => topics.id),
  userId: text('user_id').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull().default(now),
}, t => [primaryKey({columns: [t.topicId, t.userId]})]);

export const bookmarks = sqliteTable('bookmarks', {
  topicId: text('topic_id').notNull().references(() => topics.id),
  userId: text('user_id').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull().default(now),
}, t => [primaryKey({columns: [t.topicId, t.userId]})]);

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  reporterId: text('reporter_id').notNull().references(() => users.id),
  targetType: text('target_type', {enum: ['topic', 'reply']}).notNull(),
  targetId: text('target_id').notNull(),
  reason: text('reason').notNull(),
  status: text('status', {enum: ['open', 'resolved', 'dismissed']}).notNull().default('open'),
  createdAt: integer('created_at').notNull().default(now),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').references(() => users.id),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  createdAt: integer('created_at').notNull().default(now),
});

export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  objectKey: text('object_key').notNull().unique(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  state: text('state', {enum: ['pending', 'approved', 'deleted']}).notNull().default('pending'),
  createdAt: integer('created_at').notNull().default(now),
});

export const requestLimits = sqliteTable('request_limits', {
 bucket: text('bucket').primaryKey(),
 hits: integer('hits').notNull(),
 expiresAt: integer('expires_at').notNull(),
});
