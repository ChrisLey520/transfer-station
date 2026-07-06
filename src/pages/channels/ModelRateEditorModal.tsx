import React from 'react';
import { Check } from 'lucide-react';
import { LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { GuideAgentId, UpstreamModelRateTarget } from '../../types.js';
import type { ModelRateFormState } from './channelForms.js';
import { NumberField, type TranslationMap } from './ChannelModalFields.js';

export function ModelRateEditorModal({
  modelRateForm,
  modelRateTarget,
  savingModelRate,
  setModelRateForm,
  setModelRateTarget,
  onSubmit,
  t
}: {
  modelRateForm: ModelRateFormState;
  modelRateTarget: UpstreamModelRateTarget;
  savingModelRate: boolean;
  setModelRateForm: React.Dispatch<React.SetStateAction<ModelRateFormState>>;
  setModelRateTarget: (value: UpstreamModelRateTarget | null) => void;
  onSubmit: (event: React.FormEvent) => void;
  t: TranslationMap;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel channel-modal-panel" onSubmit={onSubmit}>
        <div className="section-heading">
          <div>
            <h2>{modelRateTarget.rate ? tr(t, 'editModelRate', '编辑模型计费') : tr(t, 'addModelRate', '新增模型计费')}</h2>
            <p>{modelRateTarget.channel.name}</p>
          </div>
        </div>
        <div className="channel-form-grid">
          <label>
            Agent
            <select value={modelRateForm.agentType} onChange={(event) => setModelRateForm((value) => ({ ...value, agentType: event.target.value as GuideAgentId }))}>
              <option value="claude-code">Claude Code</option>
              <option value="codex">Codex</option>
            </select>
          </label>
          <label>
            {tr(t, 'modelName', '模型名称')}
            <input value={modelRateForm.model} onChange={(event) => setModelRateForm((value) => ({ ...value, model: event.target.value }))} placeholder="claude-sonnet-5* / gpt-5.3-codex / *" required />
          </label>
          <NumberField label={tr(t, 'inputRate', '输入单价 / M')} value={modelRateForm.inputRatePerMillion} step="0.0001" onChange={(value) => setModelRateForm((current) => ({ ...current, inputRatePerMillion: value }))} />
          <NumberField label={tr(t, 'outputRate', '输出单价 / M')} value={modelRateForm.outputRatePerMillion} step="0.0001" onChange={(value) => setModelRateForm((current) => ({ ...current, outputRatePerMillion: value }))} />
          <NumberField label={tr(t, 'cacheWriteRate', '缓存写入 / M')} value={modelRateForm.cacheCreationRatePerMillion} step="0.0001" onChange={(value) => setModelRateForm((current) => ({ ...current, cacheCreationRatePerMillion: value }))} />
          <NumberField label={tr(t, 'cacheReadRate', '缓存读取 / M')} value={modelRateForm.cacheReadRatePerMillion} step="0.0001" onChange={(value) => setModelRateForm((current) => ({ ...current, cacheReadRatePerMillion: value }))} />
          <NumberField label={tr(t, 'sortOrder', '排序')} value={modelRateForm.sortOrder} onChange={(value) => setModelRateForm((current) => ({ ...current, sortOrder: value }))} />
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={modelRateForm.isDefault} onChange={(event) => setModelRateForm((value) => ({ ...value, isDefault: event.target.checked }))} />
          <span>{tr(t, 'defaultModelRate', '作为该 Agent 的默认计费')}</span>
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={() => setModelRateTarget(null)} disabled={savingModelRate}>
            {t.cancel}
          </button>
          <button type="submit" className="primary-button" disabled={savingModelRate}>
            <LoadingContent loading={savingModelRate} icon={<Check size={16} />} loadingLabel={tr(t, 'saving', '保存中...')}>
              {t.savePlan}
            </LoadingContent>
          </button>
        </div>
      </form>
    </div>
  );
}
