import { showErrorToast, showSuccessToast } from '../../components/toast.js';
import type { ApiKey, KeySecret } from '../../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../../utils/api.js';
import React from 'react';

export type KeyAgentSelection = 'claude' | 'codex';

export function useKeysPanel({
  headers,
  reload,
  t
}: {
  headers: HeadersInit;
  reload: () => Promise<void>;
  t: Record<string, string>;
}) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [useTarget, setUseTarget] = React.useState<ApiKey | null>(null);
  const [selectedAgent, setSelectedAgent] = React.useState<KeyAgentSelection>('claude');
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = React.useState(false);
  const [isCreatingKey, setIsCreatingKey] = React.useState(false);
  const [copyingKeyId, setCopyingKeyId] = React.useState('');
  const [importingKeyId, setImportingKeyId] = React.useState('');
  const [name, setName] = React.useState('');
  const [copiedId, setCopiedId] = React.useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isCreatingKey) return;
    setIsCreatingKey(true);
    try {
      const response = await fetch('/api/user/keys', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setIsCreateOpen(false);
      setName('');
      await reload();
      showSuccessToast(t.createdKeySuccess);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsCreatingKey(false);
    }
  }

  async function fetchSecret(id: string): Promise<KeySecret | null> {
    try {
      const response = await fetch(`/api/user/keys/${id}/secret`, { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.keyUnavailable));
        return null;
      }
      return payload as KeySecret;
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
      return null;
    }
  }

  async function revoke(apiKey: ApiKey) {
    if (isRevoking) return;
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/user/keys/${apiKey.id}`, { method: 'DELETE', headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setRevokeTarget(null);
      await reload();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsRevoking(false);
    }
  }

  async function copyExistingKey(apiKey: ApiKey) {
    if (copyingKeyId) return;
    setCopyingKeyId(apiKey.id);
    try {
      const secret = await fetchSecret(apiKey.id);
      if (!secret) return;
      await navigator.clipboard.writeText(secret.key);
      setCopiedId(apiKey.id);
      window.setTimeout(() => setCopiedId(''), 1400);
    } finally {
      setCopyingKeyId('');
    }
  }

  async function useWithCcSwitch(apiKey: ApiKey, app: KeyAgentSelection) {
    if (importingKeyId) return;
    setImportingKeyId(apiKey.id);
    try {
      const secret = await fetchSecret(apiKey.id);
      if (!secret) return;
      window.location.href = secret.ccSwitch[app];
      setUseTarget(null);
    } finally {
      setImportingKeyId('');
    }
  }

  function openUseModal(apiKey: ApiKey) {
    setUseTarget(apiKey);
    setSelectedAgent('claude');
  }

  return {
    copiedId,
    copyingKeyId,
    copyExistingKey,
    importingKeyId,
    isCreateOpen,
    isCreatingKey,
    isImportingUseTarget: Boolean(useTarget && importingKeyId === useTarget.id),
    isRevoking,
    name,
    openUseModal,
    revoke,
    revokeTarget,
    selectedAgent,
    setIsCreateOpen,
    setName,
    setRevokeTarget,
    setSelectedAgent,
    setUseTarget,
    submit,
    useTarget,
    useWithCcSwitch
  };
}
