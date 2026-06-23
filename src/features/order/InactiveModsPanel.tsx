import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DisplayAliasDto,
  ModIdentityDto,
  ModListEntryDto,
  ModListGroupChildDto,
  ModMetadataDto,
  ModTagBindingDto,
  SteamWorkshopOpenTarget,
  TagDefDto,
} from '@/commands';
import { DroppablePanel } from '@/features/order/Panels';
import { InactiveModRow } from '@/features/order/Rows';
import { InactivePanelActions } from '@/features/order/InactivePanelActions';
import { InactiveChildRow, InactiveEntryRow } from '@/features/order/InactiveStructuredRows';
import { canCreateInactiveGroup } from '@/features/order/model';
import type { InactiveRenderRow } from '@/features/order/model';
import { displayName } from '@/features/order/identity';
import type { Selection } from '@/features/order/types';
import { INACTIVE_DROP_ID } from './workspaceConstants';
import {
  useOrderWorkspaceData,
  useOrderWorkspaceDerived,
  useOrderWorkspaceEditActions,
  useOrderWorkspaceFilters,
  useOrderWorkspaceOpenHandlers,
  useOrderWorkspacePreview,
  useOrderWorkspaceSelection,
  useOrderWorkspaceTagCommands,
} from './context/hooks';

type RowProps = {
  aliases: DisplayAliasDto[];
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
  selectedPackageIds: Set<string>;
  modByPackageId: Map<string, ModMetadataDto>;
  onSelect: (mod: ModMetadataDto, event: MouseEvent<HTMLButtonElement>) => void;
  onSelectEntry: (
    entry: ModListEntryDto,
    selection: Selection,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  onSelectChild: (child: ModListGroupChildDto) => void;
  onContextOpen: (mod: ModMetadataDto) => void;
  onContextOpenEntry: (entry: ModListEntryDto) => void;
  onAdd: (mod: ModMetadataDto) => void;
  onActivateEntry: (entryId: string) => void;
  onActivateChild: (groupId: string, childId: string) => void;
  onDoubleClick: (mod: ModMetadataDto) => void;
  onRenameGroup: (entryId: string, name: string) => void;
  onCreateGroup: () => void;
  onEditAlias: (mod: ModMetadataDto) => void;
  onEditActiveAlias: (identity: ModIdentityDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  onToggleModTag: (identity: ModIdentityDto, tagId: string) => void;
  onCreateTag: (name: string, color: string | null) => void;
  onRenameTag: (tagId: string, name: string) => void;
  onSetTagColor: (tagId: string, color: string | null) => void;
  onDeleteTag: (tagId: string) => void;
  onReorderModTags: (identity: ModIdentityDto, tagIds: string[]) => void;
  onWarmFileInfo: (sourceKey: string | null | undefined, immediate?: boolean) => void;
};

export function InactiveModsPanel() {
  const { t } = useTranslation();
  const { library } = useOrderWorkspaceData();
  const filters = useOrderWorkspaceFilters();
  const selection = useOrderWorkspaceSelection();
  const derived = useOrderWorkspaceDerived();
  const editActions = useOrderWorkspaceEditActions();
  const preview = useOrderWorkspacePreview();
  const open = useOrderWorkspaceOpenHandlers();
  const tagCommands = useOrderWorkspaceTagCommands();
  const aliases = library.data?.settings.aliases ?? [];
  const tagDefs = library.data?.settings.tagDefs ?? [];
  const modTags = library.data?.settings.modTags ?? [];
  const rowProps: RowProps = {
    aliases,
    tagDefs,
    modTags,
    selectedPackageIds: selection.selectedInactivePackageIds,
    modByPackageId: derived.modByPackageId,
    onSelect: selection.selectInactiveMod,
    onSelectEntry: selection.selectActiveEntry,
    onSelectChild: selection.selectGroupChild,
    onContextOpen: selection.ensureInactiveSelected,
    onContextOpenEntry: selection.ensureActiveSelected,
    onAdd: editActions.addInactiveMod,
    onActivateEntry: editActions.activateEntry,
    onActivateChild: editActions.activateGroupChild,
    onDoubleClick: editActions.addInactiveMod,
    onRenameGroup: editActions.renameActiveGroup,
    onCreateGroup: editActions.createInactiveGroupDialog,
    onEditAlias: editActions.editInactiveAlias,
    onEditActiveAlias: editActions.editActiveAlias,
    onOpenModFolder: open.handleOpenModFolder,
    onOpenSteamWorkshopPage: open.handleOpenSteamWorkshopPage,
    onToggleModTag: tagCommands.handleToggleModTag,
    onCreateTag: tagCommands.handleCreateTag,
    onRenameTag: tagCommands.handleRenameTag,
    onSetTagColor: tagCommands.handleSetTagColor,
    onDeleteTag: tagCommands.handleDeleteTag,
    onReorderModTags: tagCommands.handleReorderModTags,
    onWarmFileInfo: preview.warmModPreview,
  };
  return (
    <DroppablePanel
      id={INACTIVE_DROP_ID}
      title={t('order.unintroducedTitle')}
      count={derived.inactiveRows.length}
      actions={
        <InactivePanelActions
          search={filters.inactiveSearch}
          sortKey={filters.availableSortKey}
          sortDirection={filters.availableSortDirection}
          onSearchChange={filters.setInactiveSearch}
          onSortKeyChange={filters.setAvailableSortKey}
          onToggleSortDirection={filters.toggleAvailableSortDirection}
          tagFilter={filters.inactiveTagFilter}
          onTagFilterChange={filters.setInactiveTagFilter}
          tagDefs={tagDefs}
        />
      }
    >
      {derived.inactiveRows.map((row) => (
        <InactivePanelRow key={row.id} row={row} {...rowProps} />
      ))}
    </DroppablePanel>
  );
}

function InactivePanelRow({ row, ...props }: RowProps & { row: InactiveRenderRow }) {
  if (row.kind === 'catalog') {
    return (
      <InactiveModRow
        mod={row.mod}
        label={displayName(row.mod, props.aliases)}
        tagDefs={props.tagDefs}
        modTags={props.modTags}
        selected={props.selectedPackageIds.has(row.mod.packageId)}
        canCreateGroup={canCreateInactiveGroup(props.selectedPackageIds)}
        onWarmFileInfo={props.onWarmFileInfo}
        onSelect={props.onSelect}
        onContextOpen={props.onContextOpen}
        onAdd={props.onAdd}
        onDoubleClick={props.onDoubleClick}
        onCreateGroup={props.onCreateGroup}
        onEditAlias={props.onEditAlias}
        onOpenModFolder={props.onOpenModFolder}
        onOpenSteamWorkshopPage={props.onOpenSteamWorkshopPage}
        onToggleModTag={props.onToggleModTag}
        onCreateTag={props.onCreateTag}
        onRenameTag={props.onRenameTag}
        onSetTagColor={props.onSetTagColor}
        onDeleteTag={props.onDeleteTag}
        onReorderModTags={props.onReorderModTags}
      />
    );
  }
  if (row.kind === 'entry') {
    return (
      <InactiveEntryRow
        row={row}
        aliases={props.aliases}
        tagDefs={props.tagDefs}
        modTags={props.modTags}
        modByPackageId={props.modByPackageId}
        onWarmFileInfo={props.onWarmFileInfo}
        onSelect={props.onSelectEntry}
        onContextOpen={props.onContextOpenEntry}
        onActivate={props.onActivateEntry}
        onRenameGroup={props.onRenameGroup}
        onEditAlias={props.onEditActiveAlias}
        onOpenModFolder={props.onOpenModFolder}
        onOpenSteamWorkshopPage={props.onOpenSteamWorkshopPage}
        onToggleModTag={props.onToggleModTag}
        onCreateTag={props.onCreateTag}
        onRenameTag={props.onRenameTag}
        onSetTagColor={props.onSetTagColor}
        onDeleteTag={props.onDeleteTag}
        onReorderModTags={props.onReorderModTags}
      />
    );
  }
  return (
    <InactiveChildRow
      row={row}
      aliases={props.aliases}
      tagDefs={props.tagDefs}
      modTags={props.modTags}
      modByPackageId={props.modByPackageId}
      onWarmFileInfo={props.onWarmFileInfo}
      onSelect={props.onSelectChild}
      onActivate={props.onActivateChild}
      onEditAlias={props.onEditActiveAlias}
      onOpenModFolder={props.onOpenModFolder}
      onOpenSteamWorkshopPage={props.onOpenSteamWorkshopPage}
      onToggleModTag={props.onToggleModTag}
      onCreateTag={props.onCreateTag}
      onRenameTag={props.onRenameTag}
      onSetTagColor={props.onSetTagColor}
      onDeleteTag={props.onDeleteTag}
      onReorderModTags={props.onReorderModTags}
    />
  );
}
