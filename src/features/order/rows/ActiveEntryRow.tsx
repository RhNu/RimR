import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { entrySortableId } from '@/features/order/dndIds';
import { TagColorBar } from '@/features/tags/TagColorBar';
import { colorsForIdentity } from '@/features/tags/tagModel';
import { ActiveEntryContent } from './ActiveEntryContent';
import { ActiveEntryMenu } from './ActiveEntryMenu';
import { DiagnosticIcon } from './DiagnosticIcon';
import { DropIndicator } from './DropIndicator';
import type { ActiveEntryRowProps } from './rowTypes';

export const ActiveEntryRow = memo(function ActiveEntryRow({
  entry,
  index: _index,
  aliases,
  modByPackageId,
  diagnosticsByPackage,
  tagDefs,
  modTags,
  selected,
  dropIndicator,
  onContextOpen,
  onWarmFileInfo,
  onDoubleClick,
  ...menuAndContentProps
}: ActiveEntryRowProps) {
  const sortable = useSortable({ id: entrySortableId(entry.id) });
  const diagnostics = diagnosticsForEntry(entry, diagnosticsByPackage);
  return (
    <ContextMenu onOpenChange={(open) => open && onContextOpen(entry)}>
      <ContextMenuTrigger asChild>
        <div
          ref={sortable.setNodeRef}
          onPointerEnter={() => warmEntryPreview(entry, onWarmFileInfo)}
          onDoubleClick={() => onDoubleClick(entry)}
          className={rowClassName(selected, sortable.isDragging)}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <DropIndicator edge={dropIndicator} />
          {entry.kind === 'mod' && (
            <TagColorBar colors={colorsForIdentity(modTags, tagDefs, entry.identity)} />
          )}
          <div className="flex h-7 items-center gap-2 px-2">
            <ActiveEntryContent
              entry={entry}
              aliases={aliases}
              modByPackageId={modByPackageId}
              onWarmFileInfo={onWarmFileInfo}
              onSelect={menuAndContentProps.onSelect}
            />
            <DiagnosticIcon diagnostics={diagnostics} />
          </div>
        </div>
      </ContextMenuTrigger>
      <ActiveEntryMenu
        entry={entry}
        modByPackageId={modByPackageId}
        tagDefs={tagDefs}
        modTags={modTags}
        {...menuAndContentProps}
      />
    </ContextMenu>
  );
});

function diagnosticsForEntry(
  entry: ActiveEntryRowProps['entry'],
  diagnosticsByPackage: ActiveEntryRowProps['diagnosticsByPackage'],
) {
  if (entry.kind === 'mod') {
    return diagnosticsByPackage.get(entry.identity.packageId) ?? [];
  }
  if (entry.kind === 'group') {
    return entry.entries.flatMap(
      (child) => diagnosticsByPackage.get(child.identity.packageId) ?? [],
    );
  }
  return [];
}

function warmEntryPreview(
  entry: ActiveEntryRowProps['entry'],
  warm: ActiveEntryRowProps['onWarmFileInfo'],
): void {
  if (entry.kind === 'mod') {
    warm(entry.identity.sourceKey);
  }
}

function rowClassName(selected: boolean, isDragging: boolean): string {
  return cn(
    'relative border-b border-border bg-background select-none',
    selected && 'bg-accent',
    isDragging && 'opacity-40',
  );
}
