import { useState, type ReactNode } from 'react';
import { OrderDialogView } from '@/features/order/OrderDialogView';
import { useModCatalog } from '@/features/order/context/ModCatalogContext';
import { useAppOrderDialogActions } from '@/features/order/hooks/useAppOrderDialogActions';
import { useOrderDraftStore } from '@/stores/orderDraftStore';
import { windowClient } from '@/commands';
import { AppMenuBar, type MenuId } from './AppMenuBar';
import { TitleDragRegion, WindowControls } from './WindowControls';
import { useFileMenuActions } from './useFileMenuActions';

export function AppShell({ children }: { children: ReactNode }) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const fileActions = useFileMenuActions();
  const draft = useOrderDraftStore((state) => state.draft);
  const modListMenu = useAppOrderDialogActions(draft ?? undefined);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-9 shrink-0 select-none items-center border-b border-border bg-card text-sm">
        <div
          className="flex h-full flex-1 items-center"
          data-tauri-drag-region
          onDoubleClick={(e) => {
            if (e.target === e.currentTarget) void windowClient.toggleMaximize();
          }}
        >
          <AppMenuBar
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            fileActions={fileActions}
            modListMenu={modListMenu}
          />
        </div>
        <TitleDragRegion />
        <div
          className="flex h-full flex-1 items-center justify-end"
          data-tauri-drag-region
          onDoubleClick={(e) => {
            if (e.target === e.currentTarget) void windowClient.toggleMaximize();
          }}
        >
          <WindowControls />
        </div>
      </header>
      <AppOrderDialogView
        onSubmit={modListMenu.onSubmit}
        canDeleteModList={modListMenu.canDelete}
      />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function AppOrderDialogView({
  onSubmit,
  canDeleteModList,
}: {
  onSubmit: (value: string) => void;
  canDeleteModList: boolean;
}) {
  const modByPackageId = useModCatalog();
  return (
    <OrderDialogView
      onSubmit={onSubmit}
      canDeleteModList={canDeleteModList}
      modByPackageId={modByPackageId}
    />
  );
}
