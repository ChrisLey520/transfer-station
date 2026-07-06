import type { Bootstrap } from '../types.js';
import { KeyManagementPanel } from './keys/KeyManagementPanel.js';
import { CreateKeyModal, RevokeKeyModal, UseKeyModal } from './keys/KeyModals.js';
import { useKeysPanel } from './keys/useKeysPanel.js';

export function KeysPanel({
  data,
  headers,
  reload,
  t
}: {
  data: Bootstrap;
  headers: HeadersInit;
  reload: () => Promise<void>;
  t: Record<string, string>;
}) {
  const keys = useKeysPanel({ headers, reload, t });

  return (
    <section className="content-grid">
      <KeyManagementPanel
        copiedId={keys.copiedId}
        copyingKeyId={keys.copyingKeyId}
        keys={data.keys}
        onCopy={keys.copyExistingKey}
        onCreate={() => keys.setIsCreateOpen(true)}
        onRevoke={keys.setRevokeTarget}
        onUse={keys.openUseModal}
        t={t}
      />

      {keys.isCreateOpen ? (
        <CreateKeyModal
          isCreatingKey={keys.isCreatingKey}
          name={keys.name}
          onCancel={() => {
            keys.setIsCreateOpen(false);
            keys.setName('');
          }}
          onNameChange={keys.setName}
          onSubmit={keys.submit}
          t={t}
        />
      ) : null}

      {keys.useTarget ? (
        <UseKeyModal
          isImporting={keys.isImportingUseTarget}
          onCancel={() => keys.setUseTarget(null)}
          onConfirm={() => keys.useWithCcSwitch(keys.useTarget!, keys.selectedAgent)}
          onSelectedAgentChange={keys.setSelectedAgent}
          selectedAgent={keys.selectedAgent}
          t={t}
          useTarget={keys.useTarget}
        />
      ) : null}

      {keys.revokeTarget ? (
        <RevokeKeyModal
          isRevoking={keys.isRevoking}
          onCancel={() => keys.setRevokeTarget(null)}
          onConfirm={() => keys.revoke(keys.revokeTarget!)}
          revokeTarget={keys.revokeTarget}
          t={t}
        />
      ) : null}
    </section>
  );
}
