import { memo, type MouseEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { Layers, Pencil, Plus } from 'lucide-react';
import type {
  ModIdentityDto,
  ModMetadataDto,
  ModTagBindingDto,
  SteamWorkshopOpenTarget,
  TagDefDto,
} from '@/commands';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { inactiveSortableId } from '@/features/order/dndIds';
import { ModTypeIcon } from '@/components/mod/ModTypeIcon';
import { OpenModActionsMenuItems } from '@/features/order/OpenModActionsMenuItems';
import { TagColorBar } from '@/features/tags/TagColorBar';
import { TagMenuItems } from '@/features/tags/TagMenuItems';
import { colorsForIdentity, tagIdsForIdentity } from '@/features/tags/tagModel';
import { identityForMod } from '@/features/order/identity';
import type { WarmFileInfo } from './rowTypes';

type InactiveModRowProps = {
  mod: ModMetadataDto;
  label: string;
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
  selected: boolean;
  onSelect: (mod: ModMetadataDto, event: MouseEvent<HTMLButtonElement>) => void;
  onContextOpen: (mod: ModMetadataDto) => void;
  onAdd: (mod: ModMetadataDto) => void;
  canCreateGroup: boolean;
  onCreateGroup: () => void;
  onEditAlias: (mod: ModMetadataDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  onToggleModTag: (identity: ModIdentityDto, tagId: string) => void;
  onCreateTag: (name: string, color: string | null) => void;
  onRenameTag: (tagId: string, name: string) => void;
  onSetTagColor: (tagId: string, color: string | null) => void;
  onDeleteTag: (tagId: string) => void;
  onReorderModTags: (identity: ModIdentityDto, tagIds: string[]) => void;
  onWarmFileInfo: WarmFileInfo;
  onDoubleClick: (mod: ModMetadataDto) => void;
};

export const InactiveModRow = memo(function InactiveModRow({
  mod,
  label,
  tagDefs,
  modTags,
  selected,
  onSelect,
  onContextOpen,
  onAdd,
  canCreateGroup,
  onCreateGroup,
  onEditAlias,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
  onToggleModTag,
  onCreateTag,
  onRenameTag,
  onSetTagColor,
  onDeleteTag,
  onReorderModTags,
  onWarmFileInfo,
  onDoubleClick,
}: InactiveModRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: inactiveSortableId(mod.packageId),
  });
  return (
    <ContextMenu onOpenChange={(open) => open && onContextOpen(mod)}>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          onPointerEnter={() => onWarmFileInfo(mod.sourceKey)}
          onDoubleClick={() => onDoubleClick(mod)}
          className={rowClassName(selected, isDragging)}
          {...attributes}
          {...listeners}
        >
          <TagColorBar colors={colorsForIdentity(modTags, tagDefs, identityForMod(mod))} />
          <ModTypeIcon hasAssemblies={mod.hasAssemblies} sourceKind={mod.sourceKind} />
          <button
            type="button"
            className="h-full min-w-0 flex-1 truncate text-left font-medium"
            onPointerDown={() => onWarmFileInfo(mod.sourceKey, true)}
            onFocus={() => onWarmFileInfo(mod.sourceKey, true)}
            onClick={(event) => onSelect(mod, event)}
          >
            {label}
          </button>
        </div>
      </ContextMenuTrigger>
      <InactiveModContextMenu
        mod={mod}
        tagDefs={tagDefs}
        modTags={modTags}
        canCreateGroup={canCreateGroup}
        onAdd={onAdd}
        onCreateGroup={onCreateGroup}
        onEditAlias={onEditAlias}
        onOpenModFolder={onOpenModFolder}
        onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
        onToggleModTag={onToggleModTag}
        onCreateTag={onCreateTag}
        onRenameTag={onRenameTag}
        onSetTagColor={onSetTagColor}
        onDeleteTag={onDeleteTag}
        onReorderModTags={onReorderModTags}
      />
    </ContextMenu>
  );
});

function InactiveModContextMenu({
  mod,
  tagDefs,
  modTags,
  canCreateGroup,
  onAdd,
  onCreateGroup,
  onEditAlias,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
  onToggleModTag,
  onCreateTag,
  onRenameTag,
  onSetTagColor,
  onDeleteTag,
  onReorderModTags,
}: Pick<
  InactiveModRowProps,
  | 'mod'
  | 'tagDefs'
  | 'modTags'
  | 'canCreateGroup'
  | 'onAdd'
  | 'onCreateGroup'
  | 'onEditAlias'
  | 'onOpenModFolder'
  | 'onOpenSteamWorkshopPage'
  | 'onToggleModTag'
  | 'onCreateTag'
  | 'onRenameTag'
  | 'onSetTagColor'
  | 'onDeleteTag'
  | 'onReorderModTags'
>) {
  const { t } = useTranslation();
  const identity = identityForMod(mod);
  return (
    <ContextMenuContent>
      <ContextMenuItem onSelect={() => onAdd(mod)}>
        <Plus className="size-4" />
        {t('order.context.addToActive')}
      </ContextMenuItem>
      <ContextMenuItem disabled={!canCreateGroup} onSelect={onCreateGroup}>
        <Layers className="size-4" />
        {t('order.context.createGroup')}
      </ContextMenuItem>
      <OpenModActionsMenuItems
        sourceKey={mod.sourceKey}
        workshopSourceKey={mod.sourceKind === 'workshop' ? mod.sourceKey : null}
        onOpenModFolder={onOpenModFolder}
        onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
      />
      <ContextMenuItem onSelect={() => onEditAlias(mod)}>
        <Pencil className="size-4" />
        {t('order.context.editAlias')}
      </ContextMenuItem>
      <TagMenuItems
        identity={identity}
        tagDefs={tagDefs}
        boundTagIds={tagIdsForIdentity(modTags, identity)}
        onToggleTag={(tagId) => onToggleModTag(identity, tagId)}
        onCreateTag={onCreateTag}
        onRenameTag={onRenameTag}
        onSetTagColor={onSetTagColor}
        onDeleteTag={onDeleteTag}
        onReorderModTags={onReorderModTags}
      />
    </ContextMenuContent>
  );
}

function rowClassName(selected: boolean, isDragging: boolean): string {
  return cn(
    'relative flex h-7 select-none items-center gap-2 border-b border-border px-2 text-left text-sm',
    selected && 'bg-accent',
    isDragging ? 'opacity-40' : 'hover:bg-accent/50',
  );
}
