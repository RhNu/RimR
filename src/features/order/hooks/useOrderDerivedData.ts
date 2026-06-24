import { useMemo } from 'react';
import type {
  DisplayAliasDto,
  LibraryDto,
  ModListDto,
  ModMetadataDto,
  CatalogSnapshotDto,
  ValidateOrderDto,
  ModTagBindingDto,
  TagDefDto,
} from '@/commands';
import {
  sortAvailableMods,
  type AvailableModSortKey,
  type SortDirection,
} from '@/lib/availableMods';
import { diagnosticsByPackage, summarizeValidationReport } from '@/lib/diagnostics';
import {
  activeModsKey,
  buildActiveRenderRows,
  buildInactiveRenderRows,
  filterInactiveMods,
  unintroducedMods,
  type InactiveRenderRow,
} from '@/features/order/model';

const EMPTY_ALIASES: DisplayAliasDto[] = [];
const EMPTY_TAG_DEFS: TagDefDto[] = [];
const EMPTY_MOD_TAGS: ModTagBindingDto[] = [];

type UseOrderDerivedDataParams = {
  scan: CatalogSnapshotDto | undefined;
  library: LibraryDto | undefined;
  draft: ModListDto | null;
  activeMods: string[];
  validationResult: ValidateOrderDto | null;
  inactiveSearch: string;
  activeSearch: string;
  availableSortKey: AvailableModSortKey;
  availableSortDirection: SortDirection;
  inactiveTagFilter: string;
};

export function useOrderDerivedData({
  scan,
  library,
  draft,
  activeMods,
  validationResult,
  inactiveSearch,
  activeSearch,
  availableSortKey,
  availableSortDirection,
  inactiveTagFilter,
}: UseOrderDerivedDataParams) {
  const mods = useMemo(() => scan?.catalog.mods ?? [], [scan]);
  const modByPackageId = useMemo(() => new Map(mods.map((mod) => [mod.packageId, mod])), [mods]);
  const aliases = library?.settings.aliases ?? EMPTY_ALIASES;
  const tagDefs = library?.settings.tagDefs ?? EMPTY_TAG_DEFS;
  const modTags = library?.settings.modTags ?? EMPTY_MOD_TAGS;
  const inactive = useInactiveMods({
    mods,
    draft,
    aliases,
    modTags,
    tagDefs,
    modByPackageId,
    inactiveSearch,
    inactiveTagFilter,
    availableSortKey,
    availableSortDirection,
  });
  const activeRows = useMemo(
    () =>
      buildActiveRenderRows(draft?.entries ?? [], { query: activeSearch, aliases, modByPackageId }),
    [activeSearch, aliases, draft?.entries, modByPackageId],
  );
  const diagnosticsMap = useMemo(() => diagnosticsByPackage(validationResult), [validationResult]);
  const validationSummary = useMemo(
    () => summarizeValidationReport(validationResult),
    [validationResult],
  );
  const allDiagnostics = useMemo(() => validationDiagnostics(validationResult), [validationResult]);
  const draftActiveModsKey = useMemo(() => activeModsKey(draft?.activeMods ?? []), [draft]);
  const gameActiveModsKey = useMemo(() => activeModsKey(activeMods), [activeMods]);
  const visibleActiveEntryIds = useMemo(() => visibleModEntryIds(activeRows), [activeRows]);
  const activeSourceKeys = useMemo(() => sourceKeysForRows(activeRows), [activeRows]);

  return {
    mods,
    modByPackageId,
    sortedInactiveMods: inactive.sortedInactiveMods,
    inactiveRows: inactive.inactiveRows,
    activeRows,
    diagnosticsMap,
    validationSummary,
    allDiagnostics,
    draftActiveModsKey,
    gameActiveModsKey,
    inactivePackageIds: inactive.inactivePackageIds,
    inactiveSourceKeys: inactive.inactiveSourceKeys,
    visibleActiveEntryIds,
    activeSourceKeys,
  };
}

type UseInactiveModsParams = {
  mods: ModMetadataDto[];
  draft: ModListDto | null;
  aliases: DisplayAliasDto[];
  modTags: ModTagBindingDto[];
  tagDefs: TagDefDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  inactiveSearch: string;
  inactiveTagFilter: string;
  availableSortKey: AvailableModSortKey;
  availableSortDirection: SortDirection;
};

function useInactiveMods({
  mods,
  draft,
  aliases,
  modTags,
  tagDefs,
  modByPackageId,
  inactiveSearch,
  inactiveTagFilter,
  availableSortKey,
  availableSortDirection,
}: UseInactiveModsParams): {
  sortedInactiveMods: ModMetadataDto[];
  inactiveRows: InactiveRenderRow[];
  inactivePackageIds: string[];
  inactiveSourceKeys: (string | null | undefined)[];
} {
  const inactiveMods = useMemo(() => (draft ? unintroducedMods(mods, draft) : mods), [mods, draft]);
  const filteredInactiveMods = useMemo(
    () =>
      filterInactiveMods(
        inactiveMods,
        aliases,
        inactiveSearch,
        modTags,
        tagDefs,
        inactiveTagFilter,
      ),
    [inactiveMods, aliases, inactiveSearch, modTags, tagDefs, inactiveTagFilter],
  );
  const sortedInactiveMods = useMemo(
    () => sortAvailableMods(filteredInactiveMods, availableSortKey, availableSortDirection),
    [availableSortDirection, availableSortKey, filteredInactiveMods],
  );
  const inactiveRows = useMemo(
    () =>
      buildInactiveRenderRows(draft?.entries ?? [], sortedInactiveMods, {
        query: inactiveSearch,
        aliases,
        modByPackageId,
        modTags,
        tagDefs,
        tagFilter: inactiveTagFilter,
        sortKey: availableSortKey,
        sortDirection: availableSortDirection,
      }),
    [
      aliases,
      draft?.entries,
      inactiveSearch,
      modByPackageId,
      sortedInactiveMods,
      modTags,
      tagDefs,
      inactiveTagFilter,
      availableSortKey,
      availableSortDirection,
    ],
  );
  const inactivePackageIds = useMemo(
    () => sortedInactiveMods.map((candidate) => candidate.packageId),
    [sortedInactiveMods],
  );
  const inactiveSourceKeys = useMemo(
    () => sortedInactiveMods.map((candidate) => candidate.sourceKey),
    [sortedInactiveMods],
  );
  return { sortedInactiveMods, inactiveRows, inactivePackageIds, inactiveSourceKeys };
}

function validationDiagnostics(validationResult: ValidateOrderDto | null) {
  return validationResult
    ? [
        ...validationResult.report.errors,
        ...validationResult.report.warnings,
        ...validationResult.report.infos,
      ]
    : [];
}

function visibleModEntryIds(rows: ReturnType<typeof buildActiveRenderRows>): string[] {
  return rows.flatMap((row) =>
    row.kind === 'entry' && row.entry.kind === 'mod' ? [row.entryId] : [],
  );
}

function sourceKeysForRows(rows: ReturnType<typeof buildActiveRenderRows>) {
  return rows.flatMap((row) => {
    if (row.kind === 'entry' && row.entry.kind === 'mod') return [row.entry.identity.sourceKey];
    if (row.kind === 'child') return [row.child.identity.sourceKey];
    return [];
  });
}
