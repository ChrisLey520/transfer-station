import { BreakdownItem, Empty, MetricBreakdownItem } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { UsageLog } from '../../types.js';
import { currency, percent } from '../../utils/format.js';
import { fullDate } from '../../utils/time.js';
import { ChevronDown } from 'lucide-react';

export function LogRows({
  logs,
  t,
  className,
  compactMode,
  expandedId,
  setExpandedId
}: {
  logs: UsageLog[];
  t: Record<string, string>;
  className?: string;
  compactMode?: boolean;
  expandedId?: string | null;
  setExpandedId?: (id: string | null) => void;
}) {
  if (!logs.length) return <Empty t={t} className={className} />;

  return (
    <div className={className ? `log-list ${className}` : 'log-list'}>
      {!compactMode ? (
        <div className="log-head" aria-hidden="true">
          <span>{t.model}</span>
          <span>{tr(t, 'keyName', '密钥名称')}</span>
          <span>{tr(t, 'channelNumber', '渠道编号')}</span>
          <span>{t.costUsage}</span>
          <span>{t.status}</span>
          <span>{t.requestTime}</span>
          <span>{t.latency}</span>
        </div>
      ) : null}
      {logs.map((log) => {
        const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
        const isExpanded = expandedId === log.id;
        const toggle = () => setExpandedId?.(isExpanded ? null : log.id);
        const cacheBase = log.inputTokens + log.cacheCreationInputTokens + log.cacheReadInputTokens;
        const cacheHitRate = cacheBase ? log.cacheReadInputTokens / cacheBase : 0;

        return (
          <article className="log-record" key={log.id}>
            <button type="button" className="log-summary" onClick={toggle} aria-expanded={isExpanded}>
              {!compactMode ? <ChevronDown className={isExpanded ? 'log-expand-indicator open' : 'log-expand-indicator'} size={16} /> : null}
              <div>
                <strong>{log.model}</strong>
              </div>
              <span>{log.apiKeyName || '-'}</span>
              <span>{log.channelNumber ? `#${log.channelNumber}` : '-'}</span>
              <span className="log-cost">{currency(log.totalCostCents, 'USD')}</span>
              <span className={isSuccess ? 'status-code ok' : 'status-code error'}>{isSuccess ? t.success : t.failed}</span>
              <span>{fullDate(log.createdAt)}</span>
              <span>{log.latencyMs}ms</span>
            </button>

            {isExpanded && !compactMode ? (
              <div className="log-detail">
                {isSuccess ? (
                  <div className="cost-breakdown">
                    <BreakdownItem label={t.input} tokens={log.inputTokens} cents={log.inputCostCents} />
                    <BreakdownItem label={t.output} tokens={log.outputTokens} cents={log.outputCostCents} />
                    <BreakdownItem label={t.cacheCreation} tokens={log.cacheCreationInputTokens} cents={log.cacheCreationCostCents} />
                    <BreakdownItem label={t.cacheHit} tokens={log.cacheReadInputTokens} cents={log.cacheReadCostCents} />
                    <MetricBreakdownItem label={tr(t, 'requestCacheHitRate', '本次缓存命中率')} value={percent(cacheHitRate)} />
                  </div>
                ) : (
                  <div className="failure-detail">
                    <span>{t.failureReason}</span>
                    <strong>{log.errorMessage || '-'}</strong>
                  </div>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
