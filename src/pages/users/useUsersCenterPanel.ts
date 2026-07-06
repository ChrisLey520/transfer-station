import React from 'react';
import { showErrorToast } from '../../components/toast.js';
import type { UserListPage } from '../../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../../utils/api.js';

export type UserSortField = 'freeCreditCents' | 'createdAt';
export type UserSortOrder = 'asc' | 'desc';

export function useUsersCenterPanel({ headers, refreshTick, t }: { headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [sortField, setSortField] = React.useState<UserSortField>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<UserSortOrder>('desc');
  const [page, setPage] = React.useState(1);
  const [pageData, setPageData] = React.useState<UserListPage>({ users: [], total: 0, page: 1, pageSize: 20, sortField: 'createdAt', sortOrder: 'desc' });
  const [loading, setLoading] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const [sortLoadingField, setSortLoadingField] = React.useState<UserSortField | null>(null);

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageData.pageSize), sortField, sortOrder });
      if (query.trim()) params.set('search', query.trim());
      const response = await fetch(`/api/admin/users?${params.toString()}`, { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setPageData(payload as UserListPage);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
      setIsSearching(false);
      setSortLoadingField(null);
    }
  }, [headers, page, pageData.pageSize, query, sortField, sortOrder, t.requestFailed]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers, refreshTick]);

  function toggleSort(field: UserSortField) {
    if (loading) return;
    setSortLoadingField(field);
    if (sortField === field) {
      setSortOrder((value) => (value === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(1);
  }

  function submitSearch() {
    if (loading) return;
    setIsSearching(true);
    if (search === query && page === 1) {
      void loadUsers();
      return;
    }
    setQuery(search);
    setPage(1);
  }

  return {
    isSearching,
    loading,
    pageData,
    search,
    setPage,
    setSearch,
    sortField,
    sortLoadingField,
    sortOrder,
    submitSearch,
    toggleSort
  };
}
