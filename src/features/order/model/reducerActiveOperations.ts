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
  const selected = new Set(entryIds);
  return normalizeModList({
    ...modList,
    entries: modList.entries.map((entry) => setEntryActive(entry, selected, active)),
  });
}

export function moveEntriesAndSetActive(
  modList: ModListDto,
  entryIds: string[],
  targetEntryId: string,
  edge: Exclude<DropEdge, 'inside'>,
  active: boolean,
): ModListDto {
  const updated = setEntriesActive(modList, entryIds, active);
  return normalizeModList({
    ...updated,
    entries: moveManyByTarget(updated.entries, entryIds, targetEntryId, edge),
  });
}

export function moveEntriesToGroupAndSetActive(
  modList: ModListDto,
  entryIds: string[],
  groupId: string,
  index: number,
  active: boolean,
): ModListDto {
  const selected = new Set(entryIds);
  if (selected.has(groupId)) return modList;
  const moving = modList.entries
    .filter(
      (entry): entry is Extract<ModListEntryDto, { kind: 'mod' }> =>
        selected.has(entry.id) && entry.kind === 'mod',
    )
    .map((entry) => ({ ...groupChildFromEntry(entry), active }));
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
  const selected = new Set(childIds);
  return updateGroup(modList, groupId, (group) => ({
    ...group,
    entries: group.entries.map((child) => (selected.has(child.id) ? { ...child, active } : child)),
  }));
}

function setEntryActive(
  entry: ModListEntryDto,
  selected: Set<string>,
  active: boolean,
): ModListEntryDto {
  if (!selected.has(entry.id)) return entry;
  if (entry.kind === 'mod') return { ...entry, active };
  if (entry.kind === 'group') {
    return {
      ...entry,
      entries: entry.entries.map((child) => ({ ...child, active })),
    };
  }
  return entry;
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
