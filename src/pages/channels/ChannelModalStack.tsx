import type {
  UpstreamChannel,
  UpstreamKeyAgentType,
  UpstreamKeyDeleteTarget,
  UpstreamKeyEditTarget,
  UpstreamModelRateTarget
} from '../../types.js';
import type React from 'react';
import {
  AddUpstreamKeyModal,
  ChannelEditorModal,
  CloneChannelModal,
  DeleteChannelModal,
  DeleteUpstreamKeyModal,
  EditUpstreamKeyModal,
  ModelRateEditorModal
} from './ChannelModals.js';
import type { ChannelFormState, ModelRateFormState } from './channelForms.js';

type ChannelModalStackProps = {
  channelForm: ChannelFormState;
  cloneIncludesKeys: boolean;
  cloneTarget: UpstreamChannel | null;
  cloningChannelId: string;
  deleteTarget: UpstreamChannel | null;
  deletingChannelId: string;
  deletingKeyId: string;
  isChannelOpen: boolean;
  keyAgentType: UpstreamKeyAgentType;
  keyDeleteTarget: UpstreamKeyDeleteTarget | null;
  keyEditExpiresAt: string;
  keyEditIsPermanent: boolean;
  keyEditName: string;
  keyEditTarget: UpstreamKeyEditTarget | null;
  keyEditValue: string;
  keyExpiresAt: string;
  keyIsPermanent: boolean;
  keyName: string;
  keyTarget: UpstreamChannel | null;
  keyValue: string;
  modelRateForm: ModelRateFormState;
  modelRateTarget: UpstreamModelRateTarget | null;
  onClone: (channel: UpstreamChannel) => Promise<void>;
  onDeleteChannel: (channel: UpstreamChannel) => Promise<void>;
  onDeleteKey: (target: UpstreamKeyDeleteTarget) => Promise<void>;
  onSaveChannel: (event: React.FormEvent) => Promise<void>;
  onSaveEditedKey: (event: React.FormEvent) => Promise<void>;
  onSaveKey: (event: React.FormEvent) => Promise<void>;
  onSaveModelRate: (event: React.FormEvent) => Promise<void>;
  savingChannel: boolean;
  savingEditedKey: boolean;
  savingKey: boolean;
  savingModelRate: boolean;
  setChannelForm: React.Dispatch<React.SetStateAction<ChannelFormState>>;
  setCloneIncludesKeys: React.Dispatch<React.SetStateAction<boolean>>;
  setCloneTarget: React.Dispatch<React.SetStateAction<UpstreamChannel | null>>;
  setDeleteTarget: React.Dispatch<React.SetStateAction<UpstreamChannel | null>>;
  setIsChannelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setKeyAgentType: React.Dispatch<React.SetStateAction<UpstreamKeyAgentType>>;
  setKeyDeleteTarget: React.Dispatch<React.SetStateAction<UpstreamKeyDeleteTarget | null>>;
  setKeyEditExpiresAt: React.Dispatch<React.SetStateAction<string>>;
  setKeyEditIsPermanent: React.Dispatch<React.SetStateAction<boolean>>;
  setKeyEditName: React.Dispatch<React.SetStateAction<string>>;
  setKeyEditTarget: React.Dispatch<React.SetStateAction<UpstreamKeyEditTarget | null>>;
  setKeyEditValue: React.Dispatch<React.SetStateAction<string>>;
  setKeyExpiresAt: React.Dispatch<React.SetStateAction<string>>;
  setKeyIsPermanent: React.Dispatch<React.SetStateAction<boolean>>;
  setKeyName: React.Dispatch<React.SetStateAction<string>>;
  setKeyTarget: React.Dispatch<React.SetStateAction<UpstreamChannel | null>>;
  setKeyValue: React.Dispatch<React.SetStateAction<string>>;
  setModelRateForm: React.Dispatch<React.SetStateAction<ModelRateFormState>>;
  setModelRateTarget: React.Dispatch<React.SetStateAction<UpstreamModelRateTarget | null>>;
  t: Record<string, string>;
};

export function ChannelModalStack({
  channelForm,
  cloneIncludesKeys,
  cloneTarget,
  cloningChannelId,
  deleteTarget,
  deletingChannelId,
  deletingKeyId,
  isChannelOpen,
  keyAgentType,
  keyDeleteTarget,
  keyEditExpiresAt,
  keyEditIsPermanent,
  keyEditName,
  keyEditTarget,
  keyEditValue,
  keyExpiresAt,
  keyIsPermanent,
  keyName,
  keyTarget,
  keyValue,
  modelRateForm,
  modelRateTarget,
  onClone,
  onDeleteChannel,
  onDeleteKey,
  onSaveChannel,
  onSaveEditedKey,
  onSaveKey,
  onSaveModelRate,
  savingChannel,
  savingEditedKey,
  savingKey,
  savingModelRate,
  setChannelForm,
  setCloneIncludesKeys,
  setCloneTarget,
  setDeleteTarget,
  setIsChannelOpen,
  setKeyAgentType,
  setKeyDeleteTarget,
  setKeyEditExpiresAt,
  setKeyEditIsPermanent,
  setKeyEditName,
  setKeyEditTarget,
  setKeyEditValue,
  setKeyExpiresAt,
  setKeyIsPermanent,
  setKeyName,
  setKeyTarget,
  setKeyValue,
  setModelRateForm,
  setModelRateTarget,
  t
}: ChannelModalStackProps) {
  return (
    <>
      {isChannelOpen ? (
        <ChannelEditorModal
          channelForm={channelForm}
          savingChannel={savingChannel}
          setChannelForm={setChannelForm}
          onCancel={() => setIsChannelOpen(false)}
          onSubmit={onSaveChannel}
          t={t}
        />
      ) : null}

      {keyTarget ? (
        <AddUpstreamKeyModal
          keyAgentType={keyAgentType}
          keyExpiresAt={keyExpiresAt}
          keyIsPermanent={keyIsPermanent}
          keyName={keyName}
          keyTarget={keyTarget}
          keyValue={keyValue}
          savingKey={savingKey}
          setKeyAgentType={setKeyAgentType}
          setKeyExpiresAt={setKeyExpiresAt}
          setKeyIsPermanent={setKeyIsPermanent}
          setKeyName={setKeyName}
          setKeyTarget={setKeyTarget}
          setKeyValue={setKeyValue}
          onSubmit={onSaveKey}
          t={t}
        />
      ) : null}

      {cloneTarget ? (
        <CloneChannelModal
          cloneIncludesKeys={cloneIncludesKeys}
          cloneTarget={cloneTarget}
          cloningChannelId={cloningChannelId}
          setCloneIncludesKeys={setCloneIncludesKeys}
          setCloneTarget={setCloneTarget}
          onClone={onClone}
          t={t}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteChannelModal
          deleteTarget={deleteTarget}
          deletingChannelId={deletingChannelId}
          setDeleteTarget={setDeleteTarget}
          onDelete={onDeleteChannel}
          t={t}
        />
      ) : null}

      {keyEditTarget ? (
        <EditUpstreamKeyModal
          keyEditExpiresAt={keyEditExpiresAt}
          keyEditIsPermanent={keyEditIsPermanent}
          keyEditName={keyEditName}
          keyEditTarget={keyEditTarget}
          keyEditValue={keyEditValue}
          savingEditedKey={savingEditedKey}
          setKeyEditExpiresAt={setKeyEditExpiresAt}
          setKeyEditIsPermanent={setKeyEditIsPermanent}
          setKeyEditName={setKeyEditName}
          setKeyEditTarget={setKeyEditTarget}
          setKeyEditValue={setKeyEditValue}
          onSubmit={onSaveEditedKey}
          t={t}
        />
      ) : null}

      {modelRateTarget ? (
        <ModelRateEditorModal
          modelRateForm={modelRateForm}
          modelRateTarget={modelRateTarget}
          savingModelRate={savingModelRate}
          setModelRateForm={setModelRateForm}
          setModelRateTarget={setModelRateTarget}
          onSubmit={onSaveModelRate}
          t={t}
        />
      ) : null}

      {keyDeleteTarget ? (
        <DeleteUpstreamKeyModal
          deletingKeyId={deletingKeyId}
          keyDeleteTarget={keyDeleteTarget}
          setKeyDeleteTarget={setKeyDeleteTarget}
          onDelete={onDeleteKey}
          t={t}
        />
      ) : null}
    </>
  );
}
