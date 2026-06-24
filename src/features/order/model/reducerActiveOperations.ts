import type { ModListDto, ModListEntryDto } from '@/commands';
import { moveManyByTarget } from './dnd';
import { groupChildFromEntry } from './entries';
import { normalizeModList } from './normalize';
import type { DropEdge, GroupEntry } from './types';

export function setEntriesActive(
  modList: ModListDto,
  entryIds: string[],
  active: boolean,
): ModListDto {
  if (active) return modList;
  const selected = new Set(entryIds);
  return normalizeModList({
    ...modList,
    entries: modList.entries
      .filter((entry) => !(selected.has(entry.id) && entry.kind === 'mod'))
      .map((entry) => removeGroupChildrenForSelectedGroup(entry, selected)),
  });
}

export function moveEntriesAndSetActive(
  modList: ModListDto,
  entryIds: string[],
  targetEntryId: string,
  edge: Exclude<DropEdge, 'inside'>,
  active: boolean,
): ModListDto {
  if (!active) return setEntriesActive(modList, entryIds, false);
  return normalizeModList({
    ...modList,
    entries: moveManyByTarget(modList.entries, entryIds, targetEntryId, edge),
  });
}

export function moveEntriesToGroupAndSetActive(
  modList: ModListDto,
  entryIds: string[],
  groupId: string,
  index: number,
  active: boolean,
): ModListDto {
  if (!active) return setEntriesActive(modList, entryIds, false);
  const selected = new Set(entryIds);
  if (selected.has(groupId)) return modList;
  const moving = modList.entries
    .filter(
      (entry): entry is Extract<ModListEntryDto, { kind: 'mod' }> =>
        selected.has(entry.id) && entry.kind === 'mod',
    )
    .map((entry) => ({ ...groupChildFromEntry(entry), active: true }));
  if (moving.length === 0) return modList;
  const withoutMoving = modList.entries.filter((entry) => !selected.has(entry.id));
  return normalizeModList({
    ...modList,
    entries: withoutMoving.map((entry) => {
      if (entry.kind !== 'group' || entry.id !== groupId) return entry;
      const entries = [...entry.entries];
      entries.splice(Math.min(Math.max(index, 0), entries.length), 0, ...moving);
      return { ...entry, entries };
    }),
  });
}

export function setGroupChildrenActive(
  modList: ModListDto,
  groupId: string,
  childIds: string[],
  active: boolean,
): ModListDto {
  if (active) return modList;
  const selected = new Set(childIds);
  return updateGroup(modList, groupId, (group) => ({
    ...group,
    entries: group.entries.filter((child) => !selected.has(child.id)),
  }));
}

function removeGroupChildrenForSelectedGroup(
  entry: ModListEntryDto,
  selected: Set<string>,
): ModListEntryDto {
  if (entry.kind !== 'group' || !selected.has(entry.id)) return entry;
  return { ...entry, entries: [] };
}

function updateGroup(
  modList: ModListDto,
  groupId: string,
  update: (group: GroupEntry) => GroupEntry,
): ModListDto {
  return normalizeModList({
    ...modList,
    entries: modList.entries.map((entry) =>
      entry.kind === 'group' && entry.id === groupId ? update(entry) : entry,
    ),
  });
}
