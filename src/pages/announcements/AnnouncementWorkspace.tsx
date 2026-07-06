import { LoadingContent } from '../../components/common.js';
import type { AnnouncementPreviewMode } from './useAnnouncementsPanel.js';
import { Bell, Copy, Monitor, RefreshCcw, Save, Smartphone, X } from 'lucide-react';
import type React from 'react';

export function AnnouncementWorkspace({
  announcementExists,
  characterCount,
  content,
  hasDraftChanges,
  lineCount,
  onClearDraft,
  onContentChange,
  onInsertTemplate,
  onPreviewModeChange,
  onRestoreSavedContent,
  onSubmit,
  previewContent,
  previewMode,
  publishedAtLabel,
  saving
}: {
  announcementExists: boolean;
  characterCount: number;
  content: string;
  hasDraftChanges: boolean;
  lineCount: number;
  onClearDraft: () => void;
  onContentChange: (content: string) => void;
  onInsertTemplate: (kind: 'maintenance' | 'purchase') => void;
  onPreviewModeChange: (mode: AnnouncementPreviewMode) => void;
  onRestoreSavedContent: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  previewContent: string;
  previewMode: AnnouncementPreviewMode;
  publishedAtLabel: string;
  saving: boolean;
}) {
  return (
    <section className="announcement-workspace">
      <div className="announcement-command-bar">
        <div>
          <h2>公告管理</h2>
          <p>编辑、预览并发布全站公告</p>
        </div>
        <div className="announcement-command-actions">
          <span className={hasDraftChanges ? 'announcement-status-pill is-dirty' : 'announcement-status-pill'}>
            {hasDraftChanges ? '有未发布修改' : '内容已同步'}
          </span>
          <button type="button" className="secondary-button" onClick={onRestoreSavedContent} disabled={saving || !hasDraftChanges}>
            <RefreshCcw size={16} />
            恢复
          </button>
          <button type="submit" form="announcement-publish-form" className="primary-button" disabled={saving || !content.trim()}>
            <LoadingContent loading={saving} icon={<Save size={16} />} loadingLabel="发布中...">
              发布公告
            </LoadingContent>
          </button>
        </div>
      </div>

      <div className="announcement-status-strip">
        <div>
          <span>发布状态</span>
          <strong>{announcementExists ? '已发布' : '未发布'}</strong>
        </div>
        <div>
          <span>关闭策略</span>
          <strong>发布后重置</strong>
        </div>
        <div>
          <span>发布时间</span>
          <strong>{publishedAtLabel}</strong>
        </div>
        <div>
          <span>内容规模</span>
          <strong>
            {characterCount} 字 · {lineCount} 段
          </strong>
        </div>
      </div>

      <div className="announcement-editor-layout">
        <form id="announcement-publish-form" className="announcement-form announcement-editor-card" onSubmit={onSubmit}>
          <div className="announcement-editor-head">
            <div>
              <strong>编辑内容</strong>
              <p>保存后旧公告会被覆盖删除，并重置所有用户关闭状态</p>
            </div>
            <span className="announcement-character-badge">{characterCount} 字</span>
          </div>
          <label className="announcement-field-label" htmlFor="announcement-content-editor">
            公告正文
          </label>
          <div className="announcement-editor-surface">
            <div className="announcement-toolbar" aria-label="公告编辑工具">
              <div className="announcement-toolbar-group">
                <button type="button" onClick={() => onInsertTemplate('maintenance')} disabled={saving}>
                  <Bell size={15} />
                  维护模板
                </button>
                <button type="button" onClick={() => onInsertTemplate('purchase')} disabled={saving}>
                  <Copy size={15} />
                  购买模板
                </button>
              </div>
              <button type="button" className="announcement-toolbar-danger" onClick={onClearDraft} disabled={saving || !content}>
                <X size={15} />
                清空
              </button>
            </div>
            <textarea
              id="announcement-content-editor"
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              rows={14}
              placeholder="例如：\n系统维护通知\n\n我们将于今晚 23:00 进行短时维护，期间部分请求可能出现延迟。\n维护完成后服务会自动恢复，无需额外操作。"
              required
            />
            <div className="announcement-editor-footer">
              <span>{lineCount || 0} 段</span>
              <span>{characterCount} 字</span>
              <span>{hasDraftChanges ? '草稿未发布' : '内容已同步'}</span>
            </div>
          </div>
        </form>

        <aside className="announcement-preview-card">
          <div className="announcement-preview-head">
            <div>
              <strong>弹窗预览</strong>
              <p>用户拉取个人信息时展示</p>
            </div>
            <div className="announcement-preview-switch" role="group" aria-label="预览尺寸">
              <button type="button" className={previewMode === 'desktop' ? 'active' : ''} onClick={() => onPreviewModeChange('desktop')} title="桌面预览">
                <Monitor size={15} />
              </button>
              <button type="button" className={previewMode === 'mobile' ? 'active' : ''} onClick={() => onPreviewModeChange('mobile')} title="移动预览">
                <Smartphone size={15} />
              </button>
            </div>
          </div>
          <div className={`announcement-preview-window ${previewMode === 'mobile' ? 'is-mobile' : ''}`}>
            <div className="announcement-preview-window-head">
              <div>
                <span>最新公告</span>
                <strong>{publishedAtLabel}</strong>
              </div>
              <span className="announcement-preview-badge">最新发布</span>
            </div>
            <div className="announcement-preview-body">{previewContent}</div>
            <div className="announcement-preview-actions">
              <button type="button" className="secondary-button" disabled>
                今日关闭
              </button>
              <button type="button" className="primary-button" disabled>
                关闭
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
