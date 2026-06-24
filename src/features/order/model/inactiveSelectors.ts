import type {
  DisplayAliasDto,
  ModIdentityDto,
  ModMetadataDto,
  ModListEntryDto,
  ModListGroupChildDto,
  ModTagBindingDto,
  TagDefDto,
} from '@/commands';
import {
  childSortableId,
  entrySortableId,
  inactiveCatalogSortableId,
} from '@/features/order/dndIds';
import { displayName, identityForMod, labelForIdentity } from '@/features/order/identity';
import { tagIdsForIdentity } from '@/features/tags/tagModel';
import type { AvailableModSortKey, SortDirection } from '@/lib/availableMods';
import {
  entrySearchText,
  identitySearchText,
  inactiveSearchText,
  matchesTokens,
  searchTokens,
  type RenderSearchOptions,
} from './searchSelectors';

export type InactiveRenderRow =
  | {
      kind: 'catalog';
      id: string;
      mod: ModMetadataDto;
      depth: 0;
      missing: false;
    }
  | {
      kind: 'entry';
      id: string;
      entry: ModListEntryDto;
      entryId: string;
      depth: 0;
      missing: boolean;
    }
  | {
      kind: 'child';
      id: string;
      groupId: string;
      child: ModListGroupChildDto;
      parent: Extract<ModListEntryDto, { kind: 'group' }>;
      depth: 1;
      missing: boolean;
    };

export type InactiveRenderOptions = {
  query: string;
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  modTags: ModTagBindingDto[];
  tagDefs: TagDefDto[];
  tagFilter: string;
  sortKey?: AvailableModSortKey;
  sortDirection?: SortDirection;
};

type InactiveRenderContext = {
  tokens: string[];
  searchOptions: RenderSearchOptions;
  hasTag: (identity: ModIdentityDto) => boolean;
  catalogPackageIds: Set<string>;
  sortKey: AvailableModSortKey;
  sortDirection: SortDirection;
};

type TagSearchContext = {
  tagNamesForIdentity: (identity: ModIdentityDto) => string[];
  hasTag: (identity: ModIdentityDto) => boolean;
};

function buildTagContext(
  modTags: ModTagBindingDto[],
  tagDefs: TagDefDto[],
  tagFilter: string,
): TagSearchContext {
  const defByIdMap = new Map(tagDefs.map((def) => [def.id, def] as const));
  return {
    tagNamesForIdentity: (identity: ModIdentityDto) =>
      tagIdsForIdentity(modTags, identity)
        .map((id) => defByIdMap.get(id)?.name)
        .filter((name): name is string => Boolean(name)),
    hasTag: tagFilter
      ? (identity: ModIdentityDto) => tagIdsForIdentity(modTags, identity).includes(tagFilter)
      : () => true,
  };
}

export function filterInactiveMods(
  mods: ModMetadataDto[],
  aliases: DisplayAliasDto[],
  query: string,
  modTags: ModTagBindingDto[],
  tagDefs: TagDefDto[],
  tagFilter: string,
): ModMetadataDto[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0 && !tagFilter) {
    return mods;
  }
  const { tagNamesForIdentity, hasTag } = buildTagContext(modTags, tagDefs, tagFilter);
  return mods.filter((mod) => {
    if (!hasTag(identityForMod(mod))) return false;
    if (tokens.length === 0) return true;
    return matchesTokens(inactiveSearchText(mod, aliases, tagNamesForIdentity), tokens);
  });
}

export function buildInactiveRenderRows(
  entries: ModListEntryDto[],
  catalogMods: ModMetadataDto[],
  options: InactiveRenderOptions,
): InactiveRenderRow[] {
  const ctx = inactiveRenderContext(options);
  ctx.catalogPackageIds = new Set(catalogMods.map((mod) => mod.packageId));
  const structured = new Set(structuredPackageIds(entries, ctx.catalogPackageIds));
  const groupBlocks: InactiveRenderRow[][] = [];
  const ordinaryRows: InactiveRenderRow[] = [];
  for (const entry of entries) {
    const rows = inactiveEntryRenderRows(entry, ctx);
    if (rows[0]?.kind === 'entry' && rows[0].entry.kind === 'group') {
      groupBlocks.push(rows);
    } else {
      ordinaryRows.push(...rows);
    }
  }
  for (const mod of catalogMods) {
    if (structured.has(mod.packageId)) continue;
    if (!ctx.hasTag(identityForMod(mod))) continue;
    if (
      ctx.tokens.length > 0 &&
      !matchesTokens(
        inactiveSearchText(mod, options.aliases, ctx.searchOptions.tagNamesForIdentity),
        ctx.tokens,
      )
    ) {
      continue;
    }
    ordinaryRows.push({
      kind: 'catalog',
      id: inactiveCatalogSortableId(mod.packageId),
      mod,
      depth: 0,
      missing: false,
    });
  }
  return [...sortGroupBlocks(groupBlocks, ctx).flat(), ...sortOrdinaryRows(ordinaryRows, ctx)];
}

function inactiveRenderContext(options: InactiveRenderOptions): InactiveRenderContext {
  const { tagNamesForIdentity, hasTag } = buildTagContext(
    options.modTags,
    options.tagDefs,
    options.tagFilter,
  );
  return {
    tokens: searchTokens(options.query),
    searchOptions: {
      aliases: options.aliases,
      modByPackageId: options.modByPackageId,
      tagNamesForIdentity,
    },
    hasTag,
    catalogPackageIds: new Set(),
    sortKey: options.sortKey ?? 'name',
    sortDirection: options.sortDirection ?? 'asc',
  };
}

function inactiveEntryRenderRows(
  entry: ModListEntryDto,
  ctx: InactiveRenderContext,
): InactiveRenderRow[] {
  if (entry.kind === 'separator') return [];
  if (entry.kind === 'mod') {
    return inactiveModEntryRenderRows(entry, ctx);
  }
  return inactiveGroupRenderRows(entry, ctx);
}

function inactiveModEntryRenderRows(
  entry: Extract<ModListEntryDto, { kind: 'mod' }>,
  ctx: InactiveRenderContext,
): InactiveRenderRow[] {
  const missing = !ctx.searchOptions.modByPackageId.has(entry.identity.packageId);
  if (entry.active === false && ctx.catalogPackageIds.has(entry.identity.packageId)) return [];
  if (entry.active && !missing) return [];
  if (!ctx.hasTag(entry.identity)) return [];
  if (
    ctx.tokens.length > 0 &&
    !matchesTokens(entrySearchText(entry, ctx.searchOptions), ctx.tokens)
  )
    return [];
  return [
    {
      kind: 'entry',
      id: entrySortableId(entry.id, 'inactive'),
      entry,
      entryId: entry.id,
      depth: 0,
      missing,
    },
  ];
}

function inactiveGroupRenderRows(
  entry: Extract<ModListEntryDto, { kind: 'group' }>,
  ctx: InactiveRenderContext,
): InactiveRenderRow[] {
  const groupMatches = matchesTokens(entry.name, ctx.tokens);
  const children = sortGroupChildren(inactiveGroupChildren(entry, groupMatches, ctx), ctx);
  if (ctx.tokens.length > 0 && !groupMatches && children.length === 0) return [];
  if (children.length === 0) return [];
  return [
    {
      kind: 'entry',
      id: entrySortableId(entry.id, 'inactive'),
      entry,
      entryId: entry.id,
      depth: 0,
      missing: children.every(
        (child) => !ctx.searchOptions.modByPackageId.has(child.identity.packageId),
      ),
    },
    ...children.map((child) => ({
      kind: 'child' as const,
      id: childSortableId(entry.id, child.id, 'inactive'),
      groupId: entry.id,
      child,
      parent: entry,
      depth: 1 as const,
      missing: !ctx.searchOptions.modByPackageId.has(child.identity.packageId),
    })),
  ];
}

function inactiveGroupChildren(
  entry: Extract<ModListEntryDto, { kind: 'group' }>,
  groupMatches: boolean,
  ctx: InactiveRenderContext,
): ModListGroupChildDto[] {
  return entry.entries.filter((child) => {
    const missing = !ctx.searchOptions.modByPackageId.has(child.identity.packageId);
    if (child.active && !missing) return false;
    if (!ctx.hasTag(child.identity)) return false;
    if (ctx.tokens.length === 0 || groupMatches) return true;
    return matchesTokens(identitySearchText(child.identity, ctx.searchOptions), ctx.tokens);
  });
}

function sortGroupBlocks(
  blocks: InactiveRenderRow[][],
  ctx: InactiveRenderContext,
): InactiveRenderRow[][] {
  return [...blocks].sort((a, b) => compareGroupBlocks(a, b, ctx));
}

function sortOrdinaryRows(
  rows: InactiveRenderRow[],
  ctx: InactiveRenderContext,
): InactiveRenderRow[] {
  return [...rows].sort((a, b) => compareModLikeRows(a, b, ctx));
}

function sortGroupChildren(
  children: ModListGroupChildDto[],
  ctx: InactiveRenderContext,
): ModListGroupChildDto[] {
  return [...children].sort((a, b) => compareIdentities(a.identity, b.identity, ctx));
}

function sortIdentities(
  identities: ModIdentityDto[],
  ctx: InactiveRenderContext,
): ModIdentityDto[] {
  return [...identities].sort((a, b) => compareIdentities(a, b, ctx));
}

function compareGroupBlocks(
  a: InactiveRenderRow[],
  b: InactiveRenderRow[],
  ctx: InactiveRenderContext,
): number {
  const aEntry = groupBlockEntry(a);
  const bEntry = groupBlockEntry(b);
  if (!aEntry || !bEntry) return 0;
  const primary =
    ctx.sortKey === 'modifiedAt'
      ? compareNumber(groupBlockModifiedAt(a, ctx), groupBlockModifiedAt(b, ctx))
      : compareText(groupBlockSortText(a, aEntry, ctx), groupBlockSortText(b, bEntry, ctx));
  if (primary !== 0) return primary * sortMultiplier(ctx);
  return compareText(aEntry.name, bEntry.name);
}

function compareModLikeRows(
  a: InactiveRenderRow,
  b: InactiveRenderRow,
  ctx: InactiveRenderContext,
): number {
  return compareIdentities(rowIdentity(a), rowIdentity(b), ctx);
}

function compareIdentities(
  a: ModIdentityDto,
  b: ModIdentityDto,
  ctx: InactiveRenderContext,
): number {
  const primary =
    ctx.sortKey === 'modifiedAt'
      ? compareNumber(identityModifiedAt(a, ctx), identityModifiedAt(b, ctx))
      : compareText(identitySortText(a, ctx), identitySortText(b, ctx));
  if (primary !== 0) return primary * sortMultiplier(ctx);
  return compareText(a.packageId, b.packageId);
}

function rowIdentity(row: InactiveRenderRow): ModIdentityDto {
  if (row.kind === 'catalog') return identityForMod(row.mod);
  if (row.kind === 'child') return row.child.identity;
  if (row.entry.kind === 'mod') return row.entry.identity;
  return { packageId: row.entry.id };
}

function groupBlockEntry(
  block: InactiveRenderRow[],
): Extract<ModListEntryDto, { kind: 'group' }> | null {
  const entry = block[0]?.kind === 'entry' ? block[0].entry : null;
  return entry?.kind === 'group' ? entry : null;
}

function groupBlockSortText(
  block: InactiveRenderRow[],
  group: Extract<ModListEntryDto, { kind: 'group' }>,
  ctx: InactiveRenderContext,
): string {
  if (ctx.sortKey === 'name' || ctx.sortKey === 'packageId') return group.name;
  return firstGroupBlockChildSortText(block, ctx) || group.name;
}

function firstGroupBlockChildSortText(
  block: InactiveRenderRow[],
  ctx: InactiveRenderContext,
): string {
  const sortedIdentities = sortIdentities(groupBlockChildIdentities(block), ctx);
  return sortedIdentities[0] ? identitySortText(sortedIdentities[0], ctx) : '';
}

function identitySortText(identity: ModIdentityDto, ctx: InactiveRenderContext): string {
  const mod = ctx.searchOptions.modByPackageId.get(identity.packageId);
  switch (ctx.sortKey) {
    case 'name':
      return mod
        ? displayName(mod, ctx.searchOptions.aliases)
        : labelForIdentity(identity, ctx.searchOptions.aliases, ctx.searchOptions.modByPackageId);
    case 'packageId':
      return identity.packageId;
    case 'author':
      return mod?.authors[0] ?? '';
    case 'source':
      return mod?.sourceKind ?? identity.sourceKind ?? '';
    case 'modifiedAt':
      return String(identityModifiedAt(identity, ctx));
  }
}

function groupBlockModifiedAt(block: InactiveRenderRow[], ctx: InactiveRenderContext): number {
  return Math.max(
    0,
    ...groupBlockChildIdentities(block).map((identity) => identityModifiedAt(identity, ctx)),
  );
}

function groupBlockChildIdentities(block: InactiveRenderRow[]): ModIdentityDto[] {
  return block.flatMap((row) => (row.kind === 'child' ? [row.child.identity] : []));
}

function identityModifiedAt(identity: ModIdentityDto, ctx: InactiveRenderContext): number {
  return ctx.searchOptions.modByPackageId.get(identity.packageId)?.modifiedAtMs ?? 0;
}

function sortMultiplier(ctx: InactiveRenderContext): number {
  return ctx.sortDirection === 'asc' ? 1 : -1;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

function compareNumber(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function structuredPackageIds(
  entries: ModListEntryDto[],
  catalogPackageIds: Set<string>,
): string[] {
  return entries.flatMap((entry) => {
    if (entry.kind === 'mod') {
      if (entry.active === false && catalogPackageIds.has(entry.identity.packageId)) return [];
      return [entry.identity.packageId];
    }
    if (entry.kind === 'group') return entry.entries.map((child) => child.identity.packageId);
    return [];
  });
}
