import React from 'react';
import { Check } from 'lucide-react';
import { LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { UpstreamChannel } from '../../types.js';
import type { ChannelFormState } from './channelForms.js';
import { NumberField, type TranslationMap } from './ChannelModalFields.js';

export function ChannelEditorModal({
  channelForm,
  savingChannel,
  setChannelForm,
  onCancel,
  onSubmit,
  t
}: {
  channelForm: ChannelFormState;
  savingChannel: boolean;
  setChannelForm: React.Dispatch<React.SetStateAction<ChannelFormState>>;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
  t: TranslationMap;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel channel-modal-panel" onSubmit={onSubmit}>
        <div className="section-heading">
          <div>
            <h2>{channelForm.id ? tr(t, 'editChannel', '编辑渠道') : tr(t, 'createChannel', '新增渠道')}</h2>
            <p>{tr(t, 'channelModalHint', 'Codex 与 Claude Code 可使用不同 API URL，API Key 可共享或按 Agent 独立维护。')}</p>
          </div>
        </div>
        <div className="channel-form-grid">
          <label>
            {tr(t, 'channelName', '渠道名称')}
            <input value={channelForm.name} onChange={(event) => setChannelForm((value) => ({ ...value, name: event.target.value }))} required autoFocus />
          </label>
          <label className="wide-field">
            {tr(t, 'officialWebsite', '官网地址')}
            <input
              type="url"
              value={channelForm.websiteUrl}
              onChange={(event) => setChannelForm((value) => ({ ...value, websiteUrl: event.target.value }))}
              placeholder="https://example.com"
            />
          </label>
          <label>
            {t.status}
            <select value={channelForm.status} onChange={(event) => setChannelForm((value) => ({ ...value, status: event.target.value as UpstreamChannel['status'] }))}>
              <option value="active">{tr(t, 'active', '启用')}</option>
              <option value="paused">{t.pause}</option>
              <option value="banned">{tr(t, 'banned', '封禁')}</option>
            </select>
          </label>
          <label className="wide-field">
            Claude Code API URL
            <input value={channelForm.claudeApiUrl} onChange={(event) => setChannelForm((value) => ({ ...value, claudeApiUrl: event.target.value }))} placeholder="https://api-cc.example.com" required />
          </label>
          <label className="wide-field">
            Codex API URL
            <input value={channelForm.codexApiUrl} onChange={(event) => setChannelForm((value) => ({ ...value, codexApiUrl: event.target.value }))} placeholder="https://codex.example.com" required />
          </label>
          <NumberField label={tr(t, 'inputRate', '输入单价 / M')} value={channelForm.inputRatePerMillion} step="0.01" onChange={(value) => setChannelForm((current) => ({ ...current, inputRatePerMillion: value }))} />
          <NumberField label={tr(t, 'outputRate', '输出单价 / M')} value={channelForm.outputRatePerMillion} step="0.01" onChange={(value) => setChannelForm((current) => ({ ...current, outputRatePerMillion: value }))} />
          <NumberField label={tr(t, 'cacheWriteRate', '缓存写入 / M')} value={channelForm.cacheCreationRatePerMillion} step="0.01" onChange={(value) => setChannelForm((current) => ({ ...current, cacheCreationRatePerMillion: value }))} />
          <NumberField label={tr(t, 'cacheReadRate', '缓存读取 / M')} value={channelForm.cacheReadRatePerMillion} step="0.01" onChange={(value) => setChannelForm((current) => ({ ...current, cacheReadRatePerMillion: value }))} />
          <NumberField label={tr(t, 'serverErrorRecoveryMinutes', '上游服务端错误恢复时间')} value={channelForm.serverErrorRecoveryMinutes} min="5" max="300" onChange={(value) => setChannelForm((current) => ({ ...current, serverErrorRecoveryMinutes: value }))} />
          <NumberField label={tr(t, 'displayUsageMultiplier', '显示用量倍率')} value={channelForm.displayUsageMultiplier} min="1" step="0.01" onChange={(value) => setChannelForm((current) => ({ ...current, displayUsageMultiplier: Math.max(1, Math.round((value || 1) * 100) / 100) }))} />
          <NumberField label={tr(t, 'channelPriority', '优先级（越小越靠前）')} value={channelForm.sortOrder} min="1" step="1" onChange={(value) => setChannelForm((current) => ({ ...current, sortOrder: Math.max(1, Math.trunc(value || 1)) }))} />
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={channelForm.useIndependentAgentKeys} onChange={(event) => setChannelForm((value) => ({ ...value, useIndependentAgentKeys: event.target.checked }))} />
          <span>{tr(t, 'useIndependentAgentKeys', 'Claude Code 与 Codex 使用独立 API Key')}</span>
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={savingChannel}>
            {t.cancel}
          </button>
          <button type="submit" className="primary-button" disabled={savingChannel}>
            <LoadingContent loading={savingChannel} icon={<Check size={16} />} loadingLabel={tr(t, 'saving', '保存中...')}>
              {t.savePlan}
            </LoadingContent>
          </button>
        </div>
      </form>
    </div>
  );
}
