import { LoadingContent } from '../../components/common.js';
import type { Announcement } from '../../types.js';
import { formatDateTime } from '../../utils/time.js';

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
