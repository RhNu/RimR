import type { DisplayAliasDto, ModIdentityDto, ModMetadataDto, ModListEntryDto } from '@/commands';

export type RenderSearchOptions = {
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  tagNamesForIdentity?: (identity: ModIdentityDto) => string[];
};

export function inactiveSearchText(
  mod: ModMetadataDto,
  aliases: DisplayAliasDto[],
  tagNamesForIdentity?: (identity: ModIdentityDto) => string[],
): string {
  const identity = identityForMod(mod);
  return [
    aliasForIdentity(aliases, identity),
    mod.name,
    mod.packageId,
    mod.sourceKey,
    mod.sourceKind,
    mod.authors.join(' '),
    tagNamesForIdentity?.(identity).join(' '),
  ]
    .filter(Boolean)
    .join(' ');
}

export function entrySearchText(entry: ModListEntryDto, options: RenderSearchOptions): string {
  if (entry.kind === 'mod') {
    return identitySearchText(entry.identity, options);
  }
  if (entry.kind === 'separator') {
    return entry.title;
  }
  return [
    entry.name,
    ...entry.entries.map((child) => identitySearchText(child.identity, options)),
  ].join(' ');
}

export function identitySearchText(identity: ModIdentityDto, options: RenderSearchOptions): string {
  const mod = options.modByPackageId.get(identity.packageId);
  return [
    aliasForIdentity(options.aliases, identity),
    mod?.name,
    identity.packageId,
    identity.sourceKey,
    mod?.sourceKey,
    mod?.authors.join(' '),
    options.tagNamesForIdentity?.(identity).join(' '),
  ]
    .filter(Boolean)
    .join(' ');
}

export function searchTokens(query: string): string[] {
  return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesTokens(value: string, tokens: string[]): boolean {
  if (tokens.length === 0) {
    return true;
  }
  const searchable = value.toLocaleLowerCase();
  return tokens.every((token) => searchable.includes(token));
}

function aliasForIdentity(
  aliases: DisplayAliasDto[],
  identity: ModIdentityDto,
): string | undefined {
  return aliases.find((alias) => identityMatches(alias.identity, identity))?.displayAlias;
}

function identityForMod(mod: ModMetadataDto): ModIdentityDto {
  return {
    packageId: mod.packageId,
    sourceKind: mod.sourceKind,
    sourceKey: mod.sourceKey,
    steamAppId: mod.steamAppId,
  };
}

function identityMatches(a: ModIdentityDto, b: ModIdentityDto): boolean {
  return (
    a.packageId === b.packageId &&
    (a.sourceKey ?? null) === (b.sourceKey ?? null) &&
    (a.steamAppId ?? null) === (b.steamAppId ?? null) &&
    (a.sourceKind ?? null) === (b.sourceKind ?? null)
  );
}
