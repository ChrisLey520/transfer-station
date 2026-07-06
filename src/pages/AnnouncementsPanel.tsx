import { AnnouncementModal } from './announcements/AnnouncementModal.js';
import { AnnouncementWorkspace } from './announcements/AnnouncementWorkspace.js';
import { useAnnouncementsPanel } from './announcements/useAnnouncementsPanel.js';

export function AnnouncementsPanel({ headers, refreshTick, onSaved }: { headers: HeadersInit; refreshTick: number; t: Record<string, string>; onSaved: () => Promise<void> }) {
  const announcements = useAnnouncementsPanel({ headers, refreshTick, onSaved });

  return (
    <section className="content-grid">
      <AnnouncementWorkspace
        announcementExists={Boolean(announcements.announcement)}
        characterCount={announcements.characterCount}
        content={announcements.content}
        hasDraftChanges={announcements.hasDraftChanges}
        lineCount={announcements.lineCount}
        onClearDraft={announcements.clearDraft}
        onContentChange={announcements.setContent}
        onInsertTemplate={announcements.insertTemplate}
        onPreviewModeChange={announcements.setPreviewMode}
        onRestoreSavedContent={announcements.restoreSavedContent}
        onSubmit={announcements.submit}
        previewContent={announcements.previewContent}
        previewMode={announcements.previewMode}
        publishedAtLabel={announcements.publishedAtLabel}
        saving={announcements.saving}
      />
    </section>
  );
}

export { AnnouncementModal };
