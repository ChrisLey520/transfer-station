import { db } from '../connection.js';
import { tableColumns } from './shared.js';

export function ensureAnnouncementTablesShape() {
  const announcementColumns = tableColumns('announcements');
  const stateColumns = tableColumns('user_announcement_states');

  if (!announcementColumns.has('version') && !stateColumns.has('announcement_version')) {
    return;
  }

  const latestAnnouncement = db
    .prepare('SELECT id, content, published_at, created_at, updated_at FROM announcements ORDER BY updated_at DESC LIMIT 1')
    .get() as
    | {
        id: string;
        content: string;
        published_at: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  const latestStates = latestAnnouncement
    ? (db
        .prepare(
          `
          SELECT user_id, announcement_id, closed_at, closed_for_date, created_at, updated_at
          FROM user_announcement_states
          WHERE announcement_id = ?
        `
        )
        .all(latestAnnouncement.id) as Array<{
        user_id: string;
        announcement_id: string;
        closed_at: string | null;
        closed_for_date: string | null;
        created_at: string;
        updated_at: string;
      }>)
    : [];

  const tx = db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS user_announcement_states;
      DROP TABLE IF EXISTS announcements;

      CREATE TABLE announcements (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL DEFAULT '',
        published_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE user_announcement_states (
        user_id TEXT NOT NULL,
        announcement_id TEXT NOT NULL,
        closed_at TEXT,
        closed_for_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, announcement_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
      );
    `);

    if (!latestAnnouncement) return;

    db.prepare(
      `
      INSERT INTO announcements (id, content, published_at, created_at, updated_at)
      VALUES (@id, @content, @publishedAt, @createdAt, @updatedAt)
    `
    ).run({
      id: latestAnnouncement.id,
      content: latestAnnouncement.content,
      publishedAt: latestAnnouncement.published_at,
      createdAt: latestAnnouncement.created_at,
      updatedAt: latestAnnouncement.updated_at
    });

    const insertState = db.prepare(
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
    `
    );

    for (const state of latestStates) {
      insertState.run({
        userId: state.user_id,
        announcementId: state.announcement_id,
        closedAt: state.closed_at,
        closedForDate: state.closed_for_date,
        createdAt: state.created_at,
        updatedAt: state.updated_at
      });
    }
  });

  tx();
}
