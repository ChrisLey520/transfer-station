import { showErrorToast, showSuccessToast } from '../../components/toast.js';
import { officialQqGroupNumber } from '../../config/purchase.js';
import type { Announcement } from '../../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../../utils/api.js';
import { formatDateTime } from '../../utils/time.js';
import React from 'react';

export type AnnouncementPreviewMode = 'desktop' | 'mobile';

export function useAnnouncementsPanel({
  headers,
  onSaved,
  refreshTick
}: {
  headers: HeadersInit;
  onSaved: () => Promise<void>;
  refreshTick: number;
}) {
  const [announcement, setAnnouncement] = React.useState<Announcement | null>(null);
  const [content, setContent] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState<AnnouncementPreviewMode>('desktop');
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

  React.useEffect(() => {
    void loadAnnouncement();
  }, [loadAnnouncement, refreshTick]);

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
      purchase: `礼品码购买通知\n\n活动期间购买额度，1￥ = 5$。\n\n请加入 QQ 群 ${officialQqGroupNumber} 联系管理员购买礼品码。购买后可前往“套餐/余额”兑换；如遇同步延迟，请稍后刷新页面或联系管理员处理。`
    };
    setContent((value) => (value.trim() ? `${value.trim()}\n\n${templates[kind]}` : templates[kind]));
  }

  return {
    announcement,
    characterCount,
    clearDraft: () => setContent(''),
    content,
    hasDraftChanges,
    insertTemplate,
    lineCount,
    previewContent,
    previewMode,
    publishedAtLabel,
    restoreSavedContent: () => setContent(savedContent),
    saving,
    setContent,
    setPreviewMode,
    submit
  };
}
