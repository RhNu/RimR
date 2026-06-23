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
import { identityForMod } from '@/features/order/identity';
import { tagIdsForIdentity } from '@/features/tags/tagModel';
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
};

type InactiveRenderContext = {
  tokens: string[];
  searchOptions: RenderSearchOptions;
  hasTag: (identity: ModIdentityDto) => boolean;
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
  const structured = new Set(structuredPackageIds(entries));
  const rows: InactiveRenderRow[] = [];
  for (const entry of entries) {
    rows.push(...inactiveEntryRenderRows(entry, ctx));
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
    rows.push({
      kind: 'catalog',
      id: inactiveCatalogSortableId(mod.packageId),
      mod,
      depth: 0,
      missing: false,
    });
  }
  return rows;
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
  const children = inactiveGroupChildren(entry, groupMatches, ctx);
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

function structuredPackageIds(entries: ModListEntryDto[]): string[] {
  return entries.flatMap((entry) => {
    if (entry.kind === 'mod') return [entry.identity.packageId];
    if (entry.kind === 'group') return entry.entries.map((child) => child.identity.packageId);
    return [];
  });
}
