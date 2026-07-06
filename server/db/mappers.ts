export function mapPlan(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fiveHourTokenLimit: row.five_hour_token_limit,
    weeklyTokenLimit: row.weekly_token_limit,
    priceCents: row.price_cents,
    currency: row.currency,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapProductLink(row: any) {
  return {
    itemType: row.item_type,
    itemId: row.item_id,
    channel: row.channel,
    url: row.url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapTaobaoShop(row: any) {
  return {
    id: row.id,
    nick: row.nick,
    sessionCiphertext: row.session_ciphertext,
    sessionExpiresAt: row.session_expires_at ?? null,
    messagePermittedAt: row.message_permitted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapTaobaoProductMapping(row: any) {
  return {
    id: row.id,
    numIid: row.num_iid,
    skuId: row.sku_id ?? null,
    title: row.title,
    giftType: row.gift_type,
    amountCents: row.amount_cents,
    planId: row.plan_id ?? null,
    durationMonths: row.duration_months,
    quantity: row.quantity,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapPlatformOrder(row: any) {
  return {
    id: row.id,
    platform: row.platform,
    shopId: row.shop_id ?? null,
    orderId: row.order_id,
    subOrderId: row.sub_order_id,
    buyerNick: row.buyer_nick,
    itemId: row.item_id,
    skuId: row.sku_id ?? null,
    title: row.title,
    status: row.status,
    giftCardType: row.gift_card_type ?? null,
    giftCardCode: row.gift_card_code ?? null,
    deliveryStatus: row.delivery_status,
    deliveryMessage: row.delivery_message ?? null,
    claimedAt: row.claimed_at ?? null,
    claimedByUserId: row.claimed_by_user_id ?? null,
    lastEventAt: row.last_event_at ?? null,
    rawPayload: row.raw_payload ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapKey(row: any) {
  return {
    id: row.id,
    name: row.name,
    keyHash: row.key_hash,
    keyPreview: row.key_preview,
    keyCiphertext: row.key_ciphertext ?? null,
    userId: row.user_id ?? null,
    planId: row.plan_id,
    status: row.status,
    ownerEmail: row.owner_email,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at
  };
}

export function mapLog(row: any) {
  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    apiKeyName: row.api_key_name ?? null,
    channelGroupId: row.channel_group_id ?? null,
    channelNumber: row.channel_number ?? null,
    usageSource: row.usage_source ?? 'plan',
    model: row.model,
    path: row.path,
    method: row.method,
    statusCode: row.status_code,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens,
    totalTokens: row.total_tokens,
    inputCostCents: row.input_cost_cents,
    outputCostCents: row.output_cost_cents,
    cacheCreationCostCents: row.cache_creation_cost_cents,
    cacheReadCostCents: row.cache_read_cost_cents,
    totalCostCents: row.total_cost_cents,
    latencyMs: row.latency_ms,
    errorMessage: row.error_message,
    requestId: row.request_id,
    createdAt: row.created_at
  };
}

export function mapUpstreamChannel(row: any) {
  return {
    id: row.id,
    channelNumber: Number(row.channel_number ?? 0),
    name: row.name,
    websiteUrl: row.website_url ?? '',
    status: row.status,
    claudeApiUrl: row.claude_api_url,
    codexApiUrl: row.codex_api_url,
    useIndependentAgentKeys: Boolean(row.use_independent_agent_keys),
    inputRatePerMillion: Number(row.input_rate_per_million),
    outputRatePerMillion: Number(row.output_rate_per_million),
    cacheCreationRatePerMillion: Number(row.cache_creation_rate_per_million),
    cacheReadRatePerMillion: Number(row.cache_read_rate_per_million),
    serverErrorRecoveryMinutes: Number(row.server_error_recovery_minutes ?? 10),
    displayUsageMultiplier: Number(row.display_usage_multiplier ?? 2),
    sortOrder: Number(row.sort_order),
    degradedUntil: row.degraded_until ?? null,
    degradedReason: row.degraded_reason ?? null,
    degradedStatusCode: row.degraded_status_code ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapUpstreamChannelKey(row: any) {
  return {
    id: row.id,
    channelGroupId: row.channel_group_id,
    name: row.name ?? '',
    agentType: row.agent_type,
    keyHash: row.key_hash,
    keyPreview: row.key_preview,
    keyCiphertext: row.key_ciphertext,
    status: row.status,
    sortOrder: Number(row.sort_order),
    expiresAt: row.expires_at ?? null,
    exhaustedUntil: row.exhausted_until ?? null,
    failureReason: row.failure_reason ?? null,
    failureStatusCode: row.failure_status_code ?? null,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapUpstreamModelRate(row: any) {
  return {
    id: row.id,
    channelGroupId: row.channel_group_id,
    agentType: row.agent_type,
    model: row.model,
    inputRatePerMillion: Number(row.input_rate_per_million),
    outputRatePerMillion: Number(row.output_rate_per_million),
    cacheCreationRatePerMillion: Number(row.cache_creation_rate_per_million),
    cacheReadRatePerMillion: Number(row.cache_read_rate_per_million),
    isDefault: Boolean(row.is_default),
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
