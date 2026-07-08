import { db, mapUpstreamChannelKey, nowIso } from '../../db.js';
import { encryptKey, hashKey, previewKey } from '../../crypto.js';
import type { UpstreamChannelKey, UpstreamKeyAgentType } from '../../types.js';
import { getUpstreamChannel } from './channels.js';
import {
  invalidateUpstreamSelectionCache,
  lastUsedTouchIntervalMs,
  makeId,
  normalizeUpstreamKeyAgent,
  normalizeUpstreamKeyExpiry,
  normalizeUpstreamKeyPriority,
  normalizeUpstreamKeyStatus,
  publicUpstreamKey,
  upstreamKeyTouchedAt,
  type UpstreamChannelKeyInput
} from './shared.js';

export function addUpstreamChannelKey(groupId: string, input: UpstreamChannelKeyInput) {
  const group = getUpstreamChannel(groupId);
  if (!group) return null;

  const rawKey = input.key.trim();
  if (!rawKey) {
    throw new Error('API Key 不能为空。');
  }

  const timestamp = nowIso();
  const keyHash = hashKey(rawKey);
  const existing = db.prepare('SELECT id FROM upstream_channel_keys WHERE channel_group_id = ? AND key_hash = ?').get(groupId, keyHash);
  if (existing) {
    throw new Error('该渠道内已存在这个上游 API Key。');
  }

  db.prepare(
    `
    INSERT INTO upstream_channel_keys (
      id,
      channel_group_id,
      name,
      agent_type,
      key_hash,
      key_preview,
      key_ciphertext,
      status,
      sort_order,
      expires_at,
      exhausted_until,
      failure_reason,
      failure_status_code,
      last_used_at,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @channelGroupId,
      @name,
      @agentType,
      @keyHash,
      @keyPreview,
      @keyCiphertext,
      'active',
      @sortOrder,
      @expiresAt,
      NULL,
      NULL,
      NULL,
      NULL,
      @createdAt,
      @updatedAt
    )
  `
  ).run({
    id: makeId(),
    channelGroupId: groupId,
    name: input.name?.trim() || '',
    agentType: normalizeUpstreamKeyAgent(input.agentType),
    keyHash,
    keyPreview: previewKey(rawKey),
    keyCiphertext: encryptKey(rawKey),
    sortOrder: normalizeUpstreamKeyPriority(input.sortOrder, 100),
    expiresAt: normalizeUpstreamKeyExpiry(input.expiresAt),
    createdAt: timestamp,
    updatedAt: timestamp
  });

  invalidateUpstreamSelectionCache();
  return getUpstreamChannel(groupId)!;
}

export function updateUpstreamChannelKey(
  groupId: string,
  keyId: string,
  input: Partial<{
    key: string;
    name: string;
    agentType: UpstreamKeyAgentType;
    status: UpstreamChannelKey['status'];
    sortOrder: number;
    expiresAt: string | null;
  }>
) {
  const row = db
    .prepare('SELECT * FROM upstream_channel_keys WHERE id = ? AND channel_group_id = ?')
    .get(keyId, groupId) as any;
  if (!row) return null;

  const current = mapUpstreamChannelKey(row) as UpstreamChannelKey;
  const keyUpdate = input.key?.trim();
  const next = {
    ...current,
    name: input.name === undefined ? current.name : input.name.trim(),
    agentType: input.agentType ? normalizeUpstreamKeyAgent(input.agentType) : current.agentType,
    status: input.status ? normalizeUpstreamKeyStatus(input.status) : current.status,
    sortOrder: 'sortOrder' in input ? normalizeUpstreamKeyPriority(input.sortOrder, current.sortOrder) : current.sortOrder,
    expiresAt: 'expiresAt' in input ? normalizeUpstreamKeyExpiry(input.expiresAt) : current.expiresAt,
    keyHash: current.keyHash,
    keyPreview: current.keyPreview,
    keyCiphertext: current.keyCiphertext,
    updatedAt: nowIso()
  };

  if (keyUpdate) {
    const nextHash = hashKey(keyUpdate);
    const existing = db
      .prepare('SELECT id FROM upstream_channel_keys WHERE channel_group_id = ? AND key_hash = ? AND id != ?')
      .get(groupId, nextHash, keyId);
    if (existing) {
      throw new Error('该渠道内已存在这个上游 API Key。');
    }
    next.keyHash = nextHash;
    next.keyPreview = previewKey(keyUpdate);
    next.keyCiphertext = encryptKey(keyUpdate);
  }

  db.prepare(
    `
    UPDATE upstream_channel_keys
    SET name = @name,
        agent_type = @agentType,
        key_hash = @keyHash,
        key_preview = @keyPreview,
        key_ciphertext = @keyCiphertext,
        status = @status,
        sort_order = @sortOrder,
        expires_at = @expiresAt,
        exhausted_until = CASE WHEN @status = 'active' THEN NULL ELSE exhausted_until END,
        failure_reason = CASE WHEN @status = 'active' THEN NULL ELSE failure_reason END,
        failure_status_code = CASE WHEN @status = 'active' THEN NULL ELSE failure_status_code END,
        updated_at = @updatedAt
    WHERE id = @id AND channel_group_id = @channelGroupId
  `
  ).run({
    id: keyId,
    channelGroupId: groupId,
    name: next.name,
    agentType: next.agentType,
    keyHash: next.keyHash,
    keyPreview: next.keyPreview,
    keyCiphertext: next.keyCiphertext,
    status: next.status,
    sortOrder: next.sortOrder,
    expiresAt: next.expiresAt,
    updatedAt: next.updatedAt
  });

  invalidateUpstreamSelectionCache();
  return getUpstreamChannel(groupId)!;
}

export function deleteUpstreamChannelKey(groupId: string, keyId: string) {
  const row = db
    .prepare('SELECT * FROM upstream_channel_keys WHERE id = ? AND channel_group_id = ?')
    .get(keyId, groupId) as any;
  if (!row) return null;
  const key = publicUpstreamKey(mapUpstreamChannelKey(row) as UpstreamChannelKey);
  db.prepare('DELETE FROM upstream_channel_keys WHERE id = ? AND channel_group_id = ?').run(keyId, groupId);
  invalidateUpstreamSelectionCache();
  return key;
}


export function touchUpstreamKey(id: string) {
  const now = Date.now();
  const lastTouchedAt = upstreamKeyTouchedAt.get(id) || 0;
  if (now - lastTouchedAt < lastUsedTouchIntervalMs) return;
  upstreamKeyTouchedAt.set(id, now);
  db.prepare('UPDATE upstream_channel_keys SET last_used_at = ?, updated_at = ? WHERE id = ?').run(nowIso(), nowIso(), id);
}
