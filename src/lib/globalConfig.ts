import type { DisplayAliasDto, LibrarySettingsDto, ModIdentityDto } from '@/commands';

export function mergeGlobalAliases(
  local: LibrarySettingsDto,
  imported: LibrarySettingsDto,
): LibrarySettingsDto {
  const importedKeys = new Set(imported.aliases.map((alias) => identityKey(alias.identity)));
  return {
    ...local,
    aliases: [
      ...local.aliases.filter((alias) => !importedKeys.has(identityKey(alias.identity))),
      ...imported.aliases,
    ],
  };
}

export function identityKey(identity: ModIdentityDto): string {
  return JSON.stringify([
    identity.packageId,
    identity.sourceKind ?? null,
    identity.sourceKey ?? null,
    identity.steamAppId ?? null,
  ]);
}

export function upsertDisplayAlias(
  aliases: DisplayAliasDto[],
  alias: DisplayAliasDto,
): DisplayAliasDto[] {
  return [
    ...aliases.filter(
      (candidate) => identityKey(candidate.identity) !== identityKey(alias.identity),
    ),
    alias,
  ];
}
