import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModIdentityDto, ModListDto, ModListEntryDto, ModMetadataDto } from '@/commands';
import { baseDisplayName, baseLabelForIdentity, identityForMod } from '@/features/order/identity';
import {
  canCreateActiveGroup,
  canCreateInactiveGroup,
  createGroupId,
  submitOrderDialog,
  type GameSyncResult,
  type ModListAction,
} from '@/features/order/model';
import { entryIndex } from '@/features/order/dndIds';
import type { OrderDialog } from '@/features/order/types';
import { useOrderDialogStore } from '@/stores/orderDialogStore';
import type { MutableRefObject } from 'react';

type UseOrderEditActionsParams = {
  setDialog: (dialog: OrderDialog) => void;
  draft: ModListDto | null;
  selectedEntryIds: Set<string>;
  selectedInactivePackageIds: Set<string>;
  sortedInactiveMods: ModMetadataDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  applyDraft: (action: ModListAction) => void;
  resetSelections: () => void;
  onSaveAlias: (identity: ModIdentityDto, displayAlias: string) => void;
  onApplyGameSync: (result: GameSyncResult) => void;
  onApplySaveSync: (result: GameSyncResult) => void;
  onApplyToGame: (modList: ModListDto) => void;
  onRemoveMissingMods: (modList: ModListDto, packageIds: string[]) => void;
  onDiscardDraft: () => void;
};

export function useOrderEditActions({
  setDialog,
  draft,
  selectedEntryIds,
  selectedInactivePackageIds,
  sortedInactiveMods,
  modByPackageId,
  applyDraft,
  resetSelections,
  onSaveAlias,
  onApplyGameSync,
  onApplySaveSync,
  onApplyToGame,
  onRemoveMissingMods,
  onDiscardDraft,
}: UseOrderEditActionsParams) {
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const openActions = useDialogOpenActions({
    draftRef,
    setDialog,
    applyDraft,
    modByPackageId,
  });

  function handleDialogSubmit(value: string): void {
    const dialog = useOrderDialogStore.getState().dialog;
    if (!dialog) return;
    submitOrderDialog(dialog, value, {
      applyDraft,
      onSaveAlias,
      onApplyGameSync,
      onApplySaveSync,
      onApplyToGame,
      onRemoveMissingMods,
      onDiscardDraft,
      createActiveGroup: handleCreateActiveGroup,
      createInactiveGroup: handleCreateGroupFromInactive,
    });
    setDialog(null);
  }

  function handleCreateActiveGroup(nameValue: string): void {
    const name = nameValue.trim();
    if (!canCreateActiveGroup(selectedEntryIds) || !name) return;
    applyDraft({
      type: 'createGroup',
      entryIds: [...selectedEntryIds],
      groupId: createGroupId(),
      name,
    });
    resetSelections();
  }

  function handleCreateGroupFromInactive(nameValue: string): void {
    const name = nameValue.trim();
    if (!draftRef.current || !canCreateInactiveGroup(selectedInactivePackageIds) || !name) return;
    const selectedMods = sortedInactiveMods.filter((mod) =>
      selectedInactivePackageIds.has(mod.packageId),
    );
    applyDraft({
      type: 'createGroupFromMods',
      mods: selectedMods,
      groupId: createGroupId(),
      name,
      index: draftRef.current.entries.length,
      active: false,
    });
    resetSelections();
  }

  function handleDiscardDraft(): void {
    onDiscardDraft();
    setDialog(null);
  }

  return {
    setDialog,
    handleDialogSubmit,
    handleDiscardDraft,
    ...openActions,
  };
}

function useDialogOpenActions({
  draftRef,
  setDialog,
  applyDraft,
  modByPackageId,
}: {
  draftRef: MutableRefObject<ModListDto | null>;
  setDialog: (dialog: OrderDialog) => void;
  applyDraft: (action: ModListAction) => void;
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  const { t } = useTranslation();
  return {
    addInactiveMod: useAddInactiveMod(draftRef, applyDraft),
    createInactiveGroupDialog: useCallback(() => {
      setDialog({ kind: 'createInactiveGroup', value: t('order.groupDefault') });
    }, [setDialog, t]),
    editInactiveAlias: useEditInactiveAlias(setDialog),
    removeActiveEntry: useDeactivateOrRemoveEntry(draftRef, applyDraft),
    activateEntry: useCallback(
      (entryId: string) => applyDraft({ type: 'setEntryActive', entryId, active: true }),
      [applyDraft],
    ),
    handleActiveDoubleClick: useCallback(
      (entry: ModListEntryDto) => {
        if (entry.kind === 'mod') {
          applyDraft({ type: 'setEntryActive', entryId: entry.id, active: false });
        }
      },
      [applyDraft],
    ),
    ungroupActiveEntry: useCallback(
      (groupId: string) => applyDraft({ type: 'ungroup', groupId }),
      [applyDraft],
    ),
    createActiveGroupDialog: useCallback(() => {
      setDialog({ kind: 'createActiveGroup', value: t('order.groupDefault') });
    }, [setDialog, t]),
    editActiveAlias: useEditActiveAlias(modByPackageId, setDialog),
    addSeparatorAbove: useAddSeparatorDialog(draftRef, setDialog),
    renameActiveGroup: useCallback(
      (entryId: string, name: string) => {
        setDialog({ kind: 'renameGroup', entryId, value: name });
      },
      [setDialog],
    ),
    renameActiveSeparator: useCallback(
      (entryId: string, title: string) => {
        setDialog({ kind: 'renameSeparator', entryId, value: title });
      },
      [setDialog],
    ),
    removeGroupChild: useCallback(
      (groupId: string, childId: string) => {
        applyDraft({
          type: 'setGroupChildrenActive',
          groupId,
          childIds: [childId],
          active: false,
        });
      },
      [applyDraft],
    ),
    activateGroupChild: useCallback(
      (groupId: string, childId: string) => {
        applyDraft({
          type: 'setGroupChildrenActive',
          groupId,
          childIds: [childId],
          active: true,
        });
      },
      [applyDraft],
    ),
  };
}

function useDeactivateOrRemoveEntry(
  draftRef: MutableRefObject<ModListDto | null>,
  applyDraft: (action: ModListAction) => void,
) {
  return useCallback(
    (entryId: string): void => {
      const entry = draftRef.current?.entries.find((candidate) => candidate.id === entryId);
      if (entry?.kind === 'separator') {
        applyDraft({ type: 'removeEntry', entryId });
        return;
      }
      applyDraft({ type: 'setEntryActive', entryId, active: false });
    },
    [applyDraft, draftRef],
  );
}

function useAddInactiveMod(
  draftRef: MutableRefObject<ModListDto | null>,
  applyDraft: (action: ModListAction) => void,
) {
  return useCallback(
    (mod: ModMetadataDto): void => {
      const currentDraft = draftRef.current;
      if (!currentDraft) return;
      applyDraft({ type: 'addMod', mod, index: currentDraft.entries.length });
    },
    [applyDraft, draftRef],
  );
}

function useEditInactiveAlias(setDialog: (dialog: OrderDialog) => void) {
  return useCallback(
    (mod: ModMetadataDto): void => {
      const identity = identityForMod(mod);
      const originalValue = baseDisplayName(mod);
      setDialog({
        kind: 'editAlias',
        identity,
        value: originalValue,
        originalValue,
      });
    },
    [setDialog],
  );
}

function useEditActiveAlias(
  modByPackageId: Map<string, ModMetadataDto>,
  setDialog: (dialog: OrderDialog) => void,
) {
  return useCallback(
    (identity: ModIdentityDto): void => {
      const originalValue = baseLabelForIdentity(identity, modByPackageId);
      setDialog({
        kind: 'editAlias',
        identity,
        value: originalValue,
        originalValue,
      });
    },
    [modByPackageId, setDialog],
  );
}

function useAddSeparatorDialog(
  draftRef: MutableRefObject<ModListDto | null>,
  setDialog: (dialog: OrderDialog) => void,
) {
  const { t } = useTranslation();
  return useCallback(
    (entry: ModListEntryDto): void => {
      const currentDraft = draftRef.current;
      if (!currentDraft) return;
      setDialog({
        kind: 'addSeparator',
        index: entryIndex(currentDraft, entry.id),
        value: t('order.separatorDefault'),
      });
    },
    [draftRef, setDialog, t],
  );
}
