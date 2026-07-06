import { LoadingContent } from '../components/common.js';
import { showErrorToast, showSuccessToast } from '../components/toast.js';
import { officialQqGroupNumber } from '../config/purchase.js';
import { Announcement } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { formatDateTime } from '../utils/time.js';
import { Bell, Copy, Monitor, RefreshCcw, Save, Smartphone, X } from 'lucide-react';
import React from 'react';

export function AnnouncementsPanel({ headers, refreshTick, onSaved }: { headers: HeadersInit; refreshTick: number; t: Record<string, string>; onSaved: () => Promise<void> }) {
  const [announcement, setAnnouncement] = React.useState<Announcement | null>(null);
  const [content, setContent] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState<'desktop' | 'mobile'>('desktop');
  const characterCount = content.trim().length;
  const lineCount = content.trim() ? content.trim().split(/\r?\n/).filter((line) => line.trim()).length : 0;
  const savedContent = announcement?.content || '';
  const hasDraftChanges = content !== savedContent;
  const publishedAtLabel = announcement?.publishedAt ? formatDateTime(announcement.publishedAt) : '尚未发布';
  const previewContent = content.trim() || '公告内容预览会显示在这里。';

  const loadAnnouncement = React.useCallback(async () => {
    const response = await fetch('/api/admin/announcement', { headers });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      showErrorToast(responseErrorMessage(response, payload, '获取公告失败'));
      return;
    }
    const next = (payload as { announcement: Announcement | null }).announcement;
    setAnnouncement(next);
    setContent(next?.content || '');
  }, [headers]);

  React.useEffect(() => { void loadAnnouncement(); }, [loadAnnouncement, refreshTick]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/announcement', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ content })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(responseErrorMessage(response, payload, '保存公告失败'));
      }
      const next = (payload as { announcement: Announcement }).announcement;
      setAnnouncement(next);
      setContent(next.content);
      showSuccessToast('公告已更新');
      await onSaved();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, '保存公告失败'));
    } finally {
      setSaving(false);
    }
  }

  function insertTemplate(kind: 'maintenance' | 'purchase') {
    const templates = {
      maintenance: '系统维护通知\n\n我们将于今晚 23:00 进行短时维护，期间部分请求可能出现延迟。维护完成后服务会自动恢复，无需额外操作。',
      purchase: `礼品码购买通知\n\n请加入 QQ 群 ${officialQqGroupNumber} 联系管理员购买礼品码。购买后可前往“套餐/余额”兑换；如遇同步延迟，请稍后刷新页面或联系管理员处理。`
    };
    setContent((value) => (value.trim() ? `${value.trim()}\n\n${templates[kind]}` : templates[kind]));
  }

  function clearDraft() {
    setContent('');
  }

  return (
    <section className="content-grid">
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
            <button type="button" className="secondary-button" onClick={() => setContent(savedContent)} disabled={saving || !hasDraftChanges}>
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
            <strong>{announcement ? '已发布' : '未发布'}</strong>
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
            <strong>{characterCount} 字 · {lineCount} 段</strong>
          </div>
        </div>

        <div className="announcement-editor-layout">
          <form id="announcement-publish-form" className="announcement-form announcement-editor-card" onSubmit={submit}>
            <div className="announcement-editor-head">
              <div>
                <strong>编辑内容</strong>
                <p>保存后旧公告会被覆盖删除，并重置所有用户关闭状态</p>
              </div>
              <span className="announcement-character-badge">{characterCount} 字</span>
            </div>
            <label className="announcement-field-label" htmlFor="announcement-content-editor">公告正文</label>
            <div className="announcement-editor-surface">
              <div className="announcement-toolbar" aria-label="公告编辑工具">
                <div className="announcement-toolbar-group">
                  <button type="button" onClick={() => insertTemplate('maintenance')} disabled={saving}>
                    <Bell size={15} />
                    维护模板
                  </button>
                  <button type="button" onClick={() => insertTemplate('purchase')} disabled={saving}>
                    <Copy size={15} />
                    购买模板
                  </button>
                </div>
                <button type="button" className="announcement-toolbar-danger" onClick={clearDraft} disabled={saving || !content}>
                  <X size={15} />
                  清空
                </button>
              </div>
              <textarea id="announcement-content-editor" value={content} onChange={(event) => setContent(event.target.value)} rows={14} placeholder="例如：\n系统维护通知\n\n我们将于今晚 23:00 进行短时维护，期间部分请求可能出现延迟。\n维护完成后服务会自动恢复，无需额外操作。" required />
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
                <button type="button" className={previewMode === 'desktop' ? 'active' : ''} onClick={() => setPreviewMode('desktop')} title="桌面预览">
                  <Monitor size={15} />
                </button>
                <button type="button" className={previewMode === 'mobile' ? 'active' : ''} onClick={() => setPreviewMode('mobile')} title="移动预览">
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
                <button type="button" className="secondary-button" disabled>今日关闭</button>
                <button type="button" className="primary-button" disabled>关闭</button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </section>
  );
}

export function AnnouncementModal({
  announcement,
  busyAction,
  onClose,
  onCloseToday
}: {
  announcement: Announcement;
  busyAction: 'close' | 'closeToday' | null;
  onClose: () => void;
  onCloseToday: () => void;
}) {
  const isClosingToday = busyAction === 'closeToday';
  const isClosing = busyAction === 'close';
  const isBusy = busyAction !== null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel announcement-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-modal-title">
        <div className="section-heading">
          <div>
            <h2 id="announcement-modal-title">最新公告</h2>
            <p>公告时间：{formatDateTime(announcement.publishedAt)}</p>
          </div>
        </div>
        <div className="announcement-modal-content">{announcement.content}</div>
        <div className="modal-actions announcement-modal-actions">
          <button type="button" className="secondary-button" onClick={onCloseToday} disabled={isBusy}>
            <LoadingContent loading={isClosingToday} loadingLabel="关闭中...">
              今日关闭
            </LoadingContent>
          </button>
          <button type="button" className="primary-button" onClick={onClose} disabled={isBusy}>
            <LoadingContent loading={isClosing} loadingLabel="关闭中...">
              关闭
            </LoadingContent>
          </button>
        </div>
      </section>
    </div>
  );
}
