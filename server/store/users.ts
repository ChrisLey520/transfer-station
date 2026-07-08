import crypto from 'node:crypto';
import { customAlphabet } from 'nanoid';
import { db, nowIso } from '../db.js';
import type { Announcement, User, UserRole, UserStatus } from '../types.js';
import { ensureAccountState } from './accounts.js';

const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);
const makeTemporaryPassword = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*', 16);

type UserSession = {
  user: User;
  token: string;
  expiresAt: string;
};

type AnnouncementDismissAction = 'close' | 'closeToday';

type AnnouncementWithVisibility = Announcement & {
  shouldShow: boolean;
  dismissedForToday: boolean;
  dismissedPermanently: boolean;
};

function mapUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    role: normalizeUserRole(row.role),
    status: normalizeUserStatus(row.status),
    remark: row.remark ?? null,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeUserRole(role: unknown): UserRole {
  return role === 'admin' ? 'admin' : 'member';
}

function normalizeUserStatus(status: unknown): UserStatus {
  return status === 'banned' ? 'banned' : 'active';
}

function configuredAdminEmails() {
  const emails = new Set(['demo@example.com']);
  for (const email of (process.env.ADMIN_EMAILS || '').split(',')) {
    const normalized = email.trim().toLowerCase();
    if (normalized) emails.add(normalized);
  }
  return emails;
}

function syncConfiguredAdminRoles() {
  const emails = Array.from(configuredAdminEmails());
  if (!emails.length) return;

  const update = db.prepare("UPDATE users SET role = 'admin', updated_at = @updatedAt WHERE lower(email) = @email");
  const updatedAt = nowIso();
  const tx = db.transaction(() => {
    emails.forEach((email) => update.run({ email, updatedAt }));
  });
  tx();
}

function passwordDigest(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function passwordMatches(password: string, row: { password_hash: string; password_salt: string }) {
  const digest = passwordDigest(password, row.password_salt);
  const expected = Buffer.from(row.password_hash, 'hex');
  const actual = Buffer.from(digest, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function updateUserPassword(userId: string, password: string) {
  const timestamp = nowIso();
  const salt = crypto.randomBytes(16).toString('hex');
  const result = db
    .prepare(
      `
      UPDATE users
      SET password_hash = @passwordHash,
        password_salt = @passwordSalt,
        updated_at = @updatedAt
      WHERE id = @userId
    `
    )
    .run({
      userId,
      passwordHash: passwordDigest(password, salt),
      passwordSalt: salt,
      updatedAt: timestamp
    });

  if (result.changes === 0) {
    throw new Error('用户不存在。');
  }

  return getUserById(userId)!;
}

function makeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function tokenDigest(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toPublicUser(row: any): User {
  return mapUser(row);
}

function normalizeAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    content: row.content,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getLatestAnnouncement(): Announcement | null {
  const row = db.prepare('SELECT * FROM announcements ORDER BY updated_at DESC LIMIT 1').get() as any;
  return row ? normalizeAnnouncement(row) : null;
}

function getUserAnnouncementState(userId: string, announcementId: string) {
  const row = db
    .prepare('SELECT * FROM user_announcement_states WHERE user_id = ? AND announcement_id = ?')
    .get(userId, announcementId) as
    | {
        closed_at: string | null;
        closed_for_date: string | null;
      }
    | undefined;
  return row || null;
}

function upsertUserAnnouncementState(input: {
  userId: string;
  announcementId: string;
  closedAt?: string | null;
  closedForDate?: string | null;
}) {
  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO user_announcement_states (
      user_id,
      announcement_id,
      closed_at,
      closed_for_date,
      created_at,
      updated_at
    )
    VALUES (
      @userId,
      @announcementId,
      @closedAt,
      @closedForDate,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(user_id, announcement_id) DO UPDATE SET
      closed_at = excluded.closed_at,
      closed_for_date = excluded.closed_for_date,
      updated_at = excluded.updated_at
  `
  ).run({
    userId: input.userId,
    announcementId: input.announcementId,
    closedAt: input.closedAt ?? null,
    closedForDate: input.closedForDate ?? null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

export function getAnnouncementForUser(userId: string): AnnouncementWithVisibility | null {
  const announcement = getLatestAnnouncement();
  if (!announcement) return null;

  const state = getUserAnnouncementState(userId, announcement.id);
  const dismissedPermanently = Boolean(state?.closed_at);
  const dismissedForToday = state?.closed_for_date === todayDateString();

  return {
    ...announcement,
    shouldShow: !dismissedPermanently && !dismissedForToday,
    dismissedForToday,
    dismissedPermanently
  };
}

export function saveAnnouncement(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('公告内容不能为空。');
  }

  const timestamp = nowIso();

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_announcement_states').run();
    db.prepare('DELETE FROM announcements').run();
    db.prepare(
      `
      INSERT INTO announcements (id, content, published_at, created_at, updated_at)
      VALUES (@id, @content, @publishedAt, @createdAt, @updatedAt)
    `
    ).run({
      id: makeId(),
      content: trimmed,
      publishedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  });

  tx();
  return getLatestAnnouncement()!;
}

export function dismissAnnouncementForUser(userId: string, action: AnnouncementDismissAction) {
  const announcement = getLatestAnnouncement();
  if (!announcement) {
    throw new Error('当前没有可关闭的公告。');
  }

  if (action === 'closeToday') {
    upsertUserAnnouncementState({
      userId,
      announcementId: announcement.id,
      closedAt: null,
      closedForDate: todayDateString()
    });
  } else {
    upsertUserAnnouncementState({
      userId,
      announcementId: announcement.id,
      closedAt: nowIso(),
      closedForDate: null
    });
  }

  return getAnnouncementForUser(userId);
}

export function clearAnnouncement() {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_announcement_states').run();
    db.prepare('DELETE FROM announcements').run();
  });
  tx();
}

function createUserRecord(input: { email: string; password: string; displayName?: string | null; role?: UserRole }) {
  const email = input.email.trim().toLowerCase();
  const timestamp = nowIso();
  const salt = crypto.randomBytes(16).toString('hex');
  const userId = makeId();
  const role = normalizeUserRole(input.role);
  db.prepare(
    `
    INSERT INTO users (
      id,
      email,
      role,
      password_hash,
      password_salt,
      display_name,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @email,
      @role,
      @passwordHash,
      @passwordSalt,
      @displayName,
      @createdAt,
      @updatedAt
    )
  `
  ).run({
    id: userId,
    email,
    role,
    passwordHash: passwordDigest(input.password, salt),
    passwordSalt: salt,
    displayName: input.displayName || email.split('@')[0],
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return getUserById(userId)!;
}

function createSession(user: User): UserSession {
  const token = makeToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `
    INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (@id, @userId, @tokenHash, @expiresAt, @createdAt)
  `
  ).run({
    id: makeId(),
    userId: user.id,
    tokenHash: tokenDigest(token),
    expiresAt,
    createdAt: nowIso()
  });

  return { user, token, expiresAt };
}

export function ensureDefaultUser() {
  const existing = db.prepare('SELECT * FROM users ORDER BY created_at ASC LIMIT 1').get() as any;
  const user = existing
    ? toPublicUser(existing)
    : createUserRecord({
        email: 'demo@example.com',
        password: 'demo123456',
        displayName: 'Demo',
        role: 'admin'
      });

  syncConfiguredAdminRoles();
  const refreshedUser = getUserById(user.id)!;
  db.prepare('UPDATE api_keys SET user_id = ? WHERE user_id IS NULL').run(refreshedUser.id);
  ensureAccountState(refreshedUser.id);
  return refreshedUser;
}

export function registerUser(input: { email: string; password: string; displayName?: string | null }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email.trim().toLowerCase());
  if (existing) {
    throw new Error('邮箱已注册。');
  }

  const user = createUserRecord(input);
  ensureAccountState(user.id);
  return createSession(user);
}

export function loginUser(input: { email: string; password: string }) {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(input.email.trim().toLowerCase()) as any;
  if (!row) {
    throw new Error('邮箱或密码不正确。');
  }

  if (!passwordMatches(input.password, row)) {
    throw new Error('邮箱或密码不正确。');
  }

  const user = toPublicUser(row);
  ensureAccountState(user.id);
  return createSession(user);
}

export function changeUserPassword(userId: string, input: { currentPassword: string; newPassword: string }) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!row) {
    throw new Error('用户不存在。');
  }
  if (!passwordMatches(input.currentPassword, row)) {
    throw new Error('当前密码不正确。');
  }

  return updateUserPassword(userId, input.newPassword);
}

export function resetUserPassword(userId: string) {
  const password = makeTemporaryPassword();
  const user = updateUserPassword(userId, password);
  return { user, password };
}

export function updateUserStatus(userId: string, input: { status: UserStatus; remark?: string | null }) {
  const targetUser = getUserById(userId);
  if (!targetUser) {
    throw new Error('用户不存在。');
  }

  const status = normalizeUserStatus(input.status);
  const remark = status === 'banned' ? (input.remark || '').trim() || null : null;
  const updatedAt = nowIso();
  db.prepare(
    `
    UPDATE users
    SET status = @status,
      remark = @remark,
      updated_at = @updatedAt
    WHERE id = @userId
  `
  ).run({
    userId,
    status,
    remark,
    updatedAt
  });

  return getUserDetail(userId)!;
}

export function getUserById(userId: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return row ? toPublicUser(row) : null;
}

type UserListSortField = 'freeCreditCents' | 'createdAt';
type SortOrder = 'asc' | 'desc';

type UserListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortField?: UserListSortField;
  sortOrder?: SortOrder;
};

type UserListItem = User & {
  currentPlanId: string | null;
  currentPlanName: string | null;
  freeCreditCents: number;
  planExpiresAt: string | null;
};

function mapUserListItem(row: any): UserListItem {
  return {
    ...mapUser(row),
    currentPlanId: row.current_plan_id ?? null,
    currentPlanName: row.current_plan_name ?? null,
    freeCreditCents: Number(row.free_credit_cents ?? 0),
    planExpiresAt: row.plan_expires_at ?? null
  };
}

export function listUsers(input: UserListQuery = {}) {
  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.min(Math.max(1, Math.floor(input.pageSize || 20)), 100);
  const params: Record<string, string | number> = {
    limit: pageSize,
    offset: (page - 1) * pageSize
  };
  const filters: string[] = [];

  if (input.search?.trim()) {
    const keyword = `%${input.search.trim().toLowerCase()}%`;
    filters.push(`(
      lower(users.id) LIKE @search OR
      lower(users.email) LIKE @search OR
      lower(COALESCE(users.display_name, '')) LIKE @search
    )`);
    params.search = keyword;
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = (
    db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM users
        LEFT JOIN account_state ON account_state.id = users.id
        ${where}
      `
      )
      .get(params) as { count: number }
  ).count;

  const sortFieldMap: Record<UserListSortField, string> = {
    freeCreditCents: 'COALESCE(account_state.free_credit_cents, 0)',
    createdAt: 'users.created_at'
  };
  const sortField = input.sortField && input.sortField in sortFieldMap ? input.sortField : 'createdAt';
  const sortOrder = input.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const users = db
    .prepare(
      `
      SELECT
        users.*, 
        account_state.free_credit_cents,
        account_state.current_plan_id,
        account_state.current_plan_name,
        account_state.plan_expires_at
      FROM users
      LEFT JOIN account_state ON account_state.id = users.id
      ${where}
      ORDER BY ${sortFieldMap[sortField]} ${sortOrder}, users.created_at DESC, users.id DESC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params)
    .map(mapUserListItem);

  return { users, total, page, pageSize, sortField, sortOrder };
}

export function getUserDetail(userId: string): UserListItem | null {
  const row = db
    .prepare(
      `
      SELECT
        users.*, 
        account_state.free_credit_cents,
        account_state.current_plan_id,
        account_state.current_plan_name,
        account_state.plan_expires_at
      FROM users
      LEFT JOIN account_state ON account_state.id = users.id
      WHERE users.id = ?
      LIMIT 1
    `
    )
    .get(userId);

  return row ? mapUserListItem(row) : null;
}

export function getFirstAdminUser(): User | null {
  const row = db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1").get();
  return row ? toPublicUser(row) : null;
}

export function getUserBySessionToken(token: string): User | null {
  const row = db
    .prepare(
      `
      SELECT users.*
      FROM user_sessions
      JOIN users ON users.id = user_sessions.user_id
      WHERE user_sessions.token_hash = ?
        AND user_sessions.expires_at > ?
      LIMIT 1
    `
    )
    .get(tokenDigest(token), nowIso()) as any;

  return row ? toPublicUser(row) : null;
}
