import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type {
  DisplayAliasDto,
  ModListDto,
  ModMetadataDto,
  ModTagBindingDto,
  TagDefDto,
} from '@/commands';
import {
  computeDropIntent,
  entryById,
  resolveDragAction,
  sameDropIndicator,
  type DropIndicatorState,
  type ModListAction,
} from '@/features/order/model';
import { dragOverlayForId, type DragOverlayState } from '@/features/order/view/dragOverlay';
import { parseCatalogId, parseChildId, parseEntryId } from '@/features/order/dndIds';

export function useOrderDrag({
  activeDropId,
  inactiveDropId,
  draft,
  aliases,
  modByPackageId,
  selectedInactivePackageIds,
  inactivePackageIds,
  selectedEntryIds,
  visibleActiveEntryIds,
  tagDefs,
  modTags,
  applyDraft,
}: {
  activeDropId: string;
  inactiveDropId: string;
  draft: ModListDto | null;
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  selectedInactivePackageIds: Set<string>;
  inactivePackageIds: string[];
  selectedEntryIds: Set<string>;
  visibleActiveEntryIds: string[];
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
  applyDraft: (action: ModListAction) => void;
}) {
  const [dragOverlay, setDragOverlay] = useState<DragOverlayState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(null);
  const dropIndicatorRef = useRef<DropIndicatorState | null>(null);
  const setTrackedDropIndicator: Dispatch<SetStateAction<DropIndicatorState | null>> = (update) => {
    setDropIndicator((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      dropIndicatorRef.current = next;
      return next;
    });
  };
  const handlers = createDragHandlers({
    activeDropId,
    inactiveDropId,
    draft,
    aliases,
    modByPackageId,
    selectedInactivePackageIds,
    inactivePackageIds,
    selectedEntryIds,
    visibleActiveEntryIds,
    tagDefs,
    modTags,
    applyDraft,
    dropIndicatorRef,
    setDragOverlay,
    setDropIndicator: setTrackedDropIndicator,
  });

  return {
    dragOverlay,
    dropIndicatorFor: (rowId: string) => dropIndicatorEdge(dropIndicator, rowId),
    childDropIndicatorFor: (rowId: string) => childDropIndicatorEdge(dropIndicator, rowId),
    ...handlers,
  };
}

type DragHandlerInput = {
  activeDropId: string;
  inactiveDropId: string;
  draft: ModListDto | null;
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  selectedInactivePackageIds: Set<string>;
  inactivePackageIds: string[];
  selectedEntryIds: Set<string>;
  visibleActiveEntryIds: string[];
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
  applyDraft: (action: ModListAction) => void;
  dropIndicatorRef: { current: DropIndicatorState | null };
  setDragOverlay: (overlay: DragOverlayState | null) => void;
  setDropIndicator: Dispatch<SetStateAction<DropIndicatorState | null>>;
};

function createDragHandlers({
  activeDropId,
  inactiveDropId,
  draft,
  aliases,
  modByPackageId,
  selectedInactivePackageIds,
  inactivePackageIds,
  selectedEntryIds,
  visibleActiveEntryIds,
  tagDefs,
  modTags,
  applyDraft,
  dropIndicatorRef,
  setDragOverlay,
  setDropIndicator,
}: DragHandlerInput) {
  function handleDragStart(event: DragStartEvent): void {
    setDropIndicator(null);
    setDragOverlay(
      dragOverlayForStart(event, {
        draft,
        aliases,
        modByPackageId,
        selectedInactivePackageIds,
        inactivePackageIds,
        selectedEntryIds,
        visibleActiveEntryIds,
        tagDefs,
        modTags,
      }),
    );
  }

  function handleDragOver(event: DragOverEvent): void {
    const overId = event.over ? String(event.over.id) : null;
    if (!draft || !event.over || !overId || overId === activeDropId || overId === inactiveDropId) {
      setStableDropIndicator(setDropIndicator, null);
      return;
    }
    if (!parseEntryId(overId) && !parseChildId(overId)) {
      setStableDropIndicator(setDropIndicator, null);
      return;
    }
    setStableDropIndicator(
      setDropIndicator,
      indicatorForDragOver(event, overId, draft, event.over.rect),
    );
  }

  function handleDragEnd(event: DragEndEvent): void {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const currentDropIndicator = dropIndicatorRef.current;
    setDragOverlay(null);
    setDropIndicator(null);
    const action = resolveActionForDragEnd(activeId, overId, {
      draft,
      modByPackageId,
      selectedInactivePackageIds,
      inactivePackageIds,
      selectedEntryIds,
      visibleActiveEntryIds,
      dropIndicator: currentDropIndicator,
    });
    if (action) applyDraft(action);
  }

  return {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel: () => {
      setDragOverlay(null);
      setDropIndicator(null);
    },
  };
}

function setStableDropIndicator(
  setDropIndicator: Dispatch<SetStateAction<DropIndicatorState | null>>,
  next: DropIndicatorState | null,
): void {
  setDropIndicator((current) => (sameDropIndicator(current, next) ? current : next));
}

function dragOverlayForStart(
  event: DragStartEvent,
  input: {
    draft: ModListDto | null;
    aliases: DisplayAliasDto[];
    modByPackageId: Map<string, ModMetadataDto>;
    selectedInactivePackageIds: Set<string>;
    inactivePackageIds: string[];
    selectedEntryIds: Set<string>;
    visibleActiveEntryIds: string[];
    tagDefs: TagDefDto[];
    modTags: ModTagBindingDto[];
  },
): DragOverlayState | null {
  return dragOverlayForId(
    String(event.active.id),
    input.draft,
    input.aliases,
    input.modByPackageId,
    input.selectedInactivePackageIds,
    input.inactivePackageIds,
    input.selectedEntryIds,
    input.visibleActiveEntryIds,
    input.tagDefs,
    input.modTags,
  );
}

function resolveActionForDragEnd(
  activeId: string,
  overId: string | null,
  input: {
    draft: ModListDto | null;
    modByPackageId: Map<string, ModMetadataDto>;
    selectedInactivePackageIds: Set<string>;
    inactivePackageIds: string[];
    selectedEntryIds: Set<string>;
    visibleActiveEntryIds: string[];
    dropIndicator: DropIndicatorState | null;
  },
): ModListAction | null {
  if (!input.draft || !overId) return null;
  return resolveDragAction({
    activeId,
    overId,
    modList: input.draft,
    modByPackageId: input.modByPackageId,
    selectedInactivePackageIds: input.selectedInactivePackageIds,
    inactivePackageIds: input.inactivePackageIds,
    selectedEntryIds: input.selectedEntryIds,
    visibleActiveEntryIds: input.visibleActiveEntryIds,
    dropIndicator: input.dropIndicator,
  });
}

function dropIndicatorEdge(
  indicator: DropIndicatorState | null,
  rowId: string,
): 'before' | 'inside' | 'after' | undefined {
  return indicator?.targetId === rowId ? indicator.edge : undefined;
}

function childDropIndicatorEdge(
  indicator: DropIndicatorState | null,
  rowId: string,
): 'before' | 'after' | undefined {
  const edge = dropIndicatorEdge(indicator, rowId);
  return edge === 'inside' ? undefined : edge;
}

function indicatorForDragOver(
  event: DragOverEvent,
  overId: string,
  draft: ModListDto,
  rect: { top: number; height: number },
): DropIndicatorState | null {
  const pointerY = pointerYForEvent(event);
  const entryId = parseEntryId(overId);
  if (entryId) {
    const entry = entryById(draft, entryId.entryId);
    if (!entry) return null;
    const allowInside =
      entry.kind === 'group' &&
      entryId.side === 'active' &&
      (parseCatalogId(String(event.active.id)) != null ||
        parseEntryId(String(event.active.id)) != null);
    const intent = computeDropIntent('active', overId, rect, pointerY, allowInside);
    return { targetId: overId, edge: intent.edge };
  }
  const intent = computeDropIntent('active', overId, rect, pointerY, false);
  return { targetId: overId, edge: intent.edge };
}

function pointerYForEvent(event: DragOverEvent): number {
  const over = event.over;
  const translated = event.active.rect.current.translated;
  if (translated) {
    return translated.top + translated.height / 2;
  }
  return over ? over.rect.top + over.rect.height / 2 : 0;
}
