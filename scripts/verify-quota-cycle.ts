/**
 * 临时验证脚本：验证周期额度 + 余额扣费行为。
 * 运行: DATABASE_PATH=./data/tmp-quota-verify.sqlite npx tsx scripts/verify-quota-cycle.ts
 */
import { initDb } from '../server/db/schema.js';
import { db, nowIso } from '../server/db.js';
import { createUsageLog, getQuotaSnapshot, assertQuota } from '../server/store/usage.js';
import { getAccountQuotaCycles } from '../server/store/usage.js';
import { getKeyByRawKey } from '../server/store/keys.js';

initDb();

const timestamp = nowIso();
const userId = 'user-quota-test';
const apiKeyId = 'key-quota-test';

// 准备用户/套餐/key：周额度 100 分，5h 额度 1000 分（让周额度先耗尽）
db.prepare(
  "INSERT INTO users (id, email, role, status, password_hash, password_salt, created_at, updated_at) VALUES (?, 'quota-test@example.com', 'member', 'active', 'x', 'x', ?, ?)"
).run(userId, timestamp, timestamp);
db.prepare(
  "INSERT INTO plans (id, name, description, five_hour_token_limit, weekly_token_limit, price_cents, currency, is_active, created_at, updated_at) VALUES ('plan-test', 'Test', '', 1000, 100, 0, 'USD', 1, ?, ?)"
).run(timestamp, timestamp);
db.prepare(
  "INSERT INTO account_state (id, free_credit_cents, current_plan_id, current_plan_name, current_plan_rank, plan_expires_at, updated_at) VALUES (?, 500, 'plan-test', 'Test', 1, ?, ?)"
).run(userId, new Date(Date.now() + 30 * 24 * 3600e3).toISOString(), timestamp);
db.prepare(
  "INSERT INTO api_keys (id, name, key_hash, key_preview, key_ciphertext, user_id, plan_id, status, created_at) VALUES (?, 'test', 'hash-test', 'sk-***', '', ?, 'plan-test', 'active', ?)"
).run(apiKeyId, userId, timestamp);

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${name}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}

const baseLog = {
  apiKeyId,
  channelGroupId: null,
  channelNumber: null,
  model: 'claude-fable-5',
  path: '/v1/messages',
  method: 'POST',
  statusCode: 200,
  inputTokens: 100,
  outputTokens: 100,
  totalTokens: 200,
  latencyMs: 10,
  errorMessage: null
};

// --- 场景 1：首次成功消费开启周期 ---
let snap = getQuotaSnapshot(apiKeyId);
check('初始 quotaSource 为 plan', snap.quotaSource, 'plan');
check('初始无活跃周期（用量为 0）', snap.weeklyUsed, 0);

createUsageLog({ ...baseLog, usageSource: 'plan', totalCostCents: 60, requestId: 'r1' });
const cycles1 = getAccountQuotaCycles(userId, Date.now());
check('首次消费后周期已开启', Boolean(cycles1.weeklyCycleStartAt && cycles1.fiveHourCycleStartAt), true);

snap = getQuotaSnapshot(apiKeyId);
check('周用量累计 60', snap.weeklyUsed, 60);
check('剩余周额度 40', snap.remainingWeekly, 40);

// --- 场景 2：周额度耗尽后 quotaSource 切到 balance ---
createUsageLog({ ...baseLog, usageSource: 'plan', totalCostCents: 40, requestId: 'r2' });
snap = getQuotaSnapshot(apiKeyId);
check('周额度耗尽 remainingWeekly=0', snap.remainingWeekly, 0);
check('周额度耗尽后 quotaSource=balance', snap.quotaSource, 'balance');

const keyLike = { id: apiKeyId } as any;
const quotaCheck = assertQuota(keyLike);
check('有余额时 assertQuota 放行', quotaCheck.ok, true);
check('assertQuota 返回的 quotaSource=balance', quotaCheck.quota.quotaSource, 'balance');

// --- 场景 3：balance 请求实际扣减余额 ---
createUsageLog({ ...baseLog, usageSource: quotaCheck.quota.quotaSource, totalCostCents: 30, requestId: 'r3' });
const balance = (db.prepare('SELECT free_credit_cents FROM account_state WHERE id = ?').get(userId) as any)
  .free_credit_cents;
check('余额被扣减 500-30=470', balance, 470);

// --- 场景 4：balance 消耗不影响 plan 周期用量 / 周期不提前恢复 ---
snap = getQuotaSnapshot(apiKeyId);
check('balance 消耗不计入周用量', snap.weeklyUsed, 100);
check('周额度仍为耗尽状态', snap.remainingWeekly, 0);
check('仍然走 balance', snap.quotaSource, 'balance');

// --- 场景 5：周期到期后清零，下一次成功消费重新开启周期 ---
const past = new Date(Date.now() - 8 * 24 * 3600e3).toISOString();
db.prepare('UPDATE account_state SET weekly_cycle_start_at = ?, five_hour_cycle_start_at = ? WHERE id = ?').run(
  past,
  past,
  userId
);
snap = getQuotaSnapshot(apiKeyId);
check('周期到期后用量清零', snap.weeklyUsed, 0);
check('周期到期后回到 plan', snap.quotaSource, 'plan');
const cycles2 = getAccountQuotaCycles(userId, Date.now());
check('过期锚点已被清除', cycles2.weeklyCycleStartAt, null);

createUsageLog({ ...baseLog, usageSource: 'plan', totalCostCents: 10, requestId: 'r4' });
const cycles3 = getAccountQuotaCycles(userId, Date.now());
check('新消费重新开启周期', Boolean(cycles3.weeklyCycleStartAt), true);
snap = getQuotaSnapshot(apiKeyId);
check('新周期用量只含新消费', snap.weeklyUsed, 10);

// --- 场景 6：余额也耗尽时拒绝请求 ---
db.prepare('UPDATE account_state SET free_credit_cents = 0 WHERE id = ?').run(userId);
db.prepare('UPDATE plans SET weekly_token_limit = 10 WHERE id = ?').run('plan-test');
snap = getQuotaSnapshot(apiKeyId);
check('额度+余额均尽时 quotaSource=none', snap.quotaSource, 'none');
const denied = assertQuota(keyLike);
check('额度+余额均尽时 assertQuota 拒绝', denied.ok, false);

console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
