import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
import type { ScanConfig, ScanResult } from '@/types/scan';

// ---------- Auth.js v5 tables ----------

export const users = sqliteTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
});

export const accounts = sqliteTable('account', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (t) => [
  primaryKey({ columns: [t.provider, t.providerAccountId] }),
]);

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.identifier, t.token] }),
]);

// ---------- FAUNA tables ----------

export const scans = sqliteTable('scan', {
  id: text('id').primaryKey(),
  ownerId: text('ownerId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerEmail: text('ownerEmail').notNull(),
  url: text('url').notNull(),
  status: text('status', { enum: ['queued', 'running', 'complete', 'error', 'cancelled'] }).notNull(),
  config: text('config', { mode: 'json' }).$type<ScanConfig>().notNull(),
  overallScore: integer('overallScore').notNull().default(0),
  totalPages: integer('totalPages').notNull().default(0),
  totalIssues: integer('totalIssues').notNull().default(0),
  criticalCount: integer('criticalCount').notNull().default(0),
  result: text('result', { mode: 'json' }).$type<ScanResult | null>(),
  errorMessage: text('errorMessage'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  startedAt: integer('startedAt', { mode: 'timestamp_ms' }),
  completedAt: integer('completedAt', { mode: 'timestamp_ms' }),
}, (t) => [
  index('scan_createdAt_idx').on(t.createdAt),
  index('scan_owner_idx').on(t.ownerId, t.createdAt),
  index('scan_status_idx').on(t.status),
]);
