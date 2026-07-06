import { ensureAnnouncementTablesShape } from './migrations/announcements.js';
import { ensureApiKeyOwnerColumn, ensureApiKeySecretColumns } from './migrations/api-keys.js';
import { ensureChannelNumberColumns } from './migrations/channel-numbers.js';
import { ensureGiftCardOwnerColumn } from './migrations/gift-cards.js';
import { ensurePlatformOrderClaimColumns, ensureTaobaoIntegrationTables } from './migrations/taobao.js';
import { ensureUpstreamChannelColumns, ensureUpstreamChannelStatusConstraint } from './migrations/upstream-channels.js';
import { ensureUpstreamKeyColumns, ensureUpstreamKeyScopedUniqueness, ensureUpstreamKeyStatusConstraint } from './migrations/upstream-keys.js';
import { ensureUsageLogMoneyColumns } from './migrations/usage.js';
import { ensureUserRoleColumn } from './migrations/users.js';

export function runMigrations() {
  ensureUsageLogMoneyColumns();
  ensureUserRoleColumn();
  ensureAnnouncementTablesShape();
  ensureApiKeySecretColumns();
  ensureApiKeyOwnerColumn();
  ensureGiftCardOwnerColumn();
  ensureTaobaoIntegrationTables();
  ensurePlatformOrderClaimColumns();
  ensureUpstreamChannelColumns();
  ensureUpstreamKeyColumns();
  ensureUpstreamKeyStatusConstraint();
  ensureUpstreamKeyScopedUniqueness();
  ensureChannelNumberColumns();
  ensureUpstreamChannelStatusConstraint();
}
