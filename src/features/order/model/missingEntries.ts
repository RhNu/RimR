import type { ModListDto, ModListEntryDto, ModMetadataDto } from '@/commands';
import { normalizeModList } from './normalize';

export type MissingEntryClassification = {
  active: string[];
  inactive: string[];
};

export function classifyMissingEntries(
  modList: ModListDto,
  catalogMods: ModMetadataDto[],
): MissingEntryClassification {
  const installed = new Set(catalogMods.map((mod) => mod.packageId));
  const active: string[] = [];
  const inactive: string[] = [];

  for (const entry of modList.entries) {
    if (entry.kind === 'mod') {
      collectMissingPackage(entry.identity.packageId, entry.active, installed, active, inactive);
      continue;
    }
    if (entry.kind === 'group') {
      for (const child of entry.entries) {
        collectMissingPackage(child.identity.packageId, child.active, installed, active, inactive);
      }
    }
  }

  return { active, inactive };
}

export function removeMissingEntries(modList: ModListDto, packageIds: string[]): ModListDto {
  if (packageIds.length === 0) return modList;
  const missing = new Set(packageIds);
  const entries: ModListEntryDto[] = [];
  for (const entry of modList.entries) {
    if (entry.kind === 'mod') {
      if (!missing.has(entry.identity.packageId)) {
        entries.push(entry);
      }
      continue;
    }
    if (entry.kind === 'group') {
      entries.push({
        ...entry,
        entries: entry.entries.filter((child) => !missing.has(child.identity.packageId)),
      });
      continue;
    }
    entries.push(entry);
  }
  return normalizeModList({ ...modList, entries });
}

function collectMissingPackage(
  packageId: string,
  activeState: boolean,
  installed: Set<string>,
  active: string[],
  inactive: string[],
): void {
  if (installed.has(packageId)) return;
  const target = activeState ? active : inactive;
  if (!target.includes(packageId)) {
    target.push(packageId);
  }
}
