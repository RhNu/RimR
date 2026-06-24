import type { ModListDto, ModMetadataDto } from '@/commands';
import { normalizeModList } from './normalize';
import {
  moveEntriesAndSetActive,
  moveEntriesToGroupAndSetActive,
  setEntriesActive,
  setGroupChildrenActive,
} from './reducerActiveOperations';
import {
  addMods,
  addModsToGroup,
  createGroup,
  createGroupFromMods,
  insertSeparator,
  moveEntries,
  moveEntriesToGroup,
  moveEntry,
  moveGroupChild,
  removeEntries,
  removeGroupChild,
  renameGroup,
  renameSeparator,
  ungroup,
} from './reducerOperations';
import type { ModListAction } from './types';

export { classifyMissingEntries, removeMissingEntries } from './missingEntries';

export function unintroducedMods(mods: ModMetadataDto[], modList: ModListDto): ModMetadataDto[] {
  const introduced = new Set(packagesUnavailableForInactiveCatalog(modList.entries));
  return mods.filter((mod) => !introduced.has(mod.packageId));
}

function packagesUnavailableForInactiveCatalog(entries: ModListDto['entries']): string[] {
  return entries.flatMap((entry) => {
    if (entry.kind === 'mod') return [entry.identity.packageId];
    if (entry.kind === 'group') return entry.entries.map((child) => child.identity.packageId);
    return [];
  });
}

export function modListReducer(modList: ModListDto, action: ModListAction): ModListDto {
  switch (action.type) {
    case 'replace':
      return normalizeModList(action.modList);
    case 'addMod':
      return addMods(modList, [action.mod], action.index);
    case 'addMods':
      return addMods(modList, action.mods, action.index);
    case 'addModToGroup':
      return addModsToGroup(modList, action.groupId, [action.mod], action.index);
    case 'addModsToGroup':
      return addModsToGroup(modList, action.groupId, action.mods, action.index);
    case 'removeEntry':
      return removeEntries(modList, [action.entryId]);
    case 'removeEntries':
      return removeEntries(modList, action.entryIds);
    case 'removeGroupChild':
      return removeGroupChild(modList, action.groupId, action.childId);
    case 'setEntryActive':
      return setEntriesActive(modList, [action.entryId], action.active);
    case 'setEntriesActive':
      return setEntriesActive(modList, action.entryIds, action.active);
    case 'setGroupChildrenActive':
      return setGroupChildrenActive(modList, action.groupId, action.childIds, action.active);
    case 'moveEntry':
      return moveEntry(modList, action.entryId, action.targetEntryId, action.edge);
    case 'moveEntries':
      return moveEntries(modList, action.entryIds, action.targetEntryId, action.edge);
    case 'moveEntriesAndSetActive':
      return moveEntriesAndSetActive(
        modList,
        action.entryIds,
        action.targetEntryId,
        action.edge,
        action.active,
      );
    case 'moveEntriesToGroup':
      return moveEntriesToGroup(modList, action.entryIds, action.groupId, action.index);
    case 'moveEntriesToGroupAndSetActive':
      return moveEntriesToGroupAndSetActive(
        modList,
        action.entryIds,
        action.groupId,
        action.index,
        action.active,
      );
    case 'moveGroupChild':
      return moveGroupChild(
        modList,
        action.groupId,
        action.childId,
        action.targetChildId,
        action.edge,
      );
    case 'createGroup':
      return createGroup(modList, action.entryIds, action.groupId, action.name);
    case 'createGroupFromMods':
      return createGroupFromMods(
        modList,
        action.mods,
        action.groupId,
        action.name,
        action.index,
        action.active ?? true,
      );
    case 'renameGroup':
      return renameGroup(modList, action.groupId, action.name);
    case 'ungroup':
      return ungroup(modList, action.groupId);
    case 'insertSeparator':
      return insertSeparator(modList, action.separator, action.index);
    case 'renameSeparator':
      return renameSeparator(modList, action.entryId, action.title);
  }
}
