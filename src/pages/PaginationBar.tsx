import { ButtonSpinner } from '../components/common.js';
import { tr } from '../i18n.js';
import { compact } from '../utils/format.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  loading = false,
  t,
  totalLabel
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  t?: Record<string, string>;
  totalLabel?: string;
}) {
  const [pendingDirection, setPendingDirection] = React.useState<'prev' | 'next' | null>(null);
  const [pendingPage, setPendingPage] = React.useState<number | null>(null);
  const [jumpPageValue, setJumpPageValue] = React.useState('');
  const wasLoadingRef = React.useRef(false);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const quickPageStart = Math.max(1, safePage - 4);
  const quickPageEnd = Math.min(pageCount, safePage + 5);
  const quickPages = Array.from({ length: quickPageEnd - quickPageStart + 1 }, (_, index) => quickPageStart + index);

  React.useEffect(() => {
    if (wasLoadingRef.current && !loading) {
      setPendingDirection(null);
      setPendingPage(null);
    }
    wasLoadingRef.current = loading;
  }, [loading]);

  React.useEffect(() => {
    setJumpPageValue('');
  }, [page]);

  function changePage(nextPage: number, direction: 'prev' | 'next') {
    if (loading) return;
    const normalizedPage = Math.min(Math.max(1, nextPage), pageCount);
    if (normalizedPage === safePage) return;
    setPendingDirection(direction);
    setPendingPage(normalizedPage);
    onPageChange(normalizedPage);
  }

  function selectPage(nextPage: number) {
    if (loading || nextPage === safePage) return;
    setPendingDirection(null);
    setPendingPage(nextPage);
    onPageChange(nextPage);
  }

  function submitJump(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    const nextPage = Math.min(Math.max(1, Math.trunc(Number(jumpPageValue))), pageCount);
    if (!Number.isFinite(nextPage) || nextPage === safePage) return;
    selectPage(nextPage);
  }

  return (
    <div className="pagination-bar">
      <span>{totalLabel || tr(t || {}, 'totalItems', '共 {total} 条').replace('{total}', String(total))}</span>
      <div className="pagination-controls">
        <button type="button" className="icon-button compact" onClick={() => changePage(safePage - 1, 'prev')} disabled={loading || safePage <= 1} title={tr(t || {}, 'previousPage', '上一页')}>
          {pendingDirection === 'prev' ? <ButtonSpinner size={16} /> : <ChevronLeft size={16} />}
        </button>
        <strong>{safePage} / {pageCount}</strong>
        <div className="pagination-page-list" aria-label={tr(t || {}, 'quickPages', '快捷页码')}>
          {quickPages.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={pageNumber === safePage ? 'pagination-page-button active' : 'pagination-page-button'}
              onClick={() => selectPage(pageNumber)}
              disabled={loading || pageNumber === safePage}
              aria-current={pageNumber === safePage ? 'page' : undefined}
            >
              {pendingPage === pageNumber && loading ? <ButtonSpinner size={12} /> : pageNumber}
            </button>
          ))}
        </div>
        <button type="button" className="icon-button compact" onClick={() => changePage(safePage + 1, 'next')} disabled={loading || safePage >= pageCount} title={tr(t || {}, 'nextPage', '下一页')}>
          {pendingDirection === 'next' ? <ButtonSpinner size={16} /> : <ChevronRight size={16} />}
        </button>
        <form className="pagination-jump-form" onSubmit={submitJump}>
          <input
            type="number"
            min="1"
            max={pageCount}
            step="1"
            inputMode="numeric"
            value={jumpPageValue}
            onChange={(event) => setJumpPageValue(event.target.value)}
            placeholder={tr(t || {}, 'pageNumber', '页码')}
            disabled={loading}
          />
          <button type="submit" className="secondary-button" disabled={loading || !jumpPageValue.trim()}>
            {tr(t || {}, 'jumpToPage', '跳转')}
          </button>
        </form>
      </div>
    </div>
  );
}
