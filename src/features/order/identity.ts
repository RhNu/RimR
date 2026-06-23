import type { DisplayAliasDto, ModIdentityDto, ModMetadataDto } from '@/commands';
import { officialDisplayName } from '@/lib/officialContent';

export function displayName(mod: ModMetadataDto, aliases: DisplayAliasDto[]): string {
  return (
    findAlias(aliases, identityForMod(mod))?.displayAlias ??
    officialDisplayName(mod.packageId) ??
    mod.name ??
    mod.packageId
  );
}

export function labelForIdentity(
  identity: ModIdentityDto,
  aliases: DisplayAliasDto[],
  modByPackageId: Map<string, ModMetadataDto>,
): string {
  return (
    findAlias(aliases, identity)?.displayAlias ??
    officialDisplayName(identity.packageId) ??
    modByPackageId.get(identity.packageId)?.name ??
    identity.packageId
  );
}

export function baseDisplayName(mod: ModMetadataDto): string {
  return officialDisplayName(mod.packageId) ?? mod.name ?? mod.packageId;
}

export function baseLabelForIdentity(
  identity: ModIdentityDto,
  modByPackageId: Map<string, ModMetadataDto>,
): string {
  return (
    officialDisplayName(identity.packageId) ??
    modByPackageId.get(identity.packageId)?.name ??
    identity.packageId
  );
}

export function identityForMod(mod: ModMetadataDto): ModIdentityDto {
  return {
    packageId: mod.packageId,
    sourceKind: mod.sourceKind,
    sourceKey: mod.sourceKey,
    steamAppId: mod.steamAppId,
  };
}

export function findAlias(
  aliases: DisplayAliasDto[],
  identity: ModIdentityDto,
): DisplayAliasDto | undefined {
  return aliases.find((alias) => identityMatches(alias.identity, identity));
}

export function upsertAlias(
  aliases: DisplayAliasDto[],
  identity: ModIdentityDto,
  displayAlias: string,
): DisplayAliasDto[] {
  const next = aliases.filter((alias) => !identityMatches(alias.identity, identity));
  if (displayAlias) {
    next.push({ identity, displayAlias });
  }
  return next;
}

export function identityMatches(a: ModIdentityDto, b: ModIdentityDto): boolean {
  return (
    a.packageId === b.packageId &&
    (a.sourceKey ?? null) === (b.sourceKey ?? null) &&
    (a.steamAppId ?? null) === (b.steamAppId ?? null) &&
    (a.sourceKind ?? null) === (b.sourceKind ?? null)
  );
}
