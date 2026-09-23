import { useState } from 'react';
import { LogOut, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ROLE_LABELS, type Role } from '@/config/roles';
import { cn } from '@/lib/utils';
import { mobileOverflowFor, mobileTabsFor, type NavItem, type TabId } from './navigation';

interface MobileTabBarProps {
  role: Role;
  displayName: string;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  pendingCount: number;
  onLogout: () => void;
}

function TabButton({ item, active, badge, onClick }: {
  item: Pick<NavItem, 'label' | 'icon'>; active: boolean; badge?: number; onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex flex-1 flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span className="relative">
        <Icon className="size-5" aria-hidden="true" />
        {!!badge && (
          <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      {item.label}
    </button>
  );
}

export function MobileTabBar({ role, displayName, activeTab, onTabChange, pendingCount, onLogout }: MobileTabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = mobileTabsFor(role);
  const overflow = mobileOverflowFor(role);
  const overflowActive = overflow.some((i) => i.id === activeTab);

  const go = (tab: TabId) => {
    setMoreOpen(false);
    onTabChange(tab);
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-lg">
          {tabs.map((item) => (
            <TabButton
              key={item.id}
              item={{ ...item, label: item.id === 'home' ? 'Home' : item.id === 'staff' ? 'Team' : item.label }}
              active={activeTab === item.id}
              badge={item.id === 'requests' ? pendingCount : undefined}
              onClick={() => go(item.id)}
            />
          ))}
          <TabButton item={{ label: 'More', icon: Menu }} active={overflowActive} onClick={() => setMoreOpen(true)} />
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl pb-safe">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-3">
              <UserAvatar name={displayName} size="lg" />
              <div>
                <SheetTitle>{displayName}</SheetTitle>
                <SheetDescription>{ROLE_LABELS[role]}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="overflow-y-auto px-2 pb-2">
            {overflow.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-accent',
                  activeTab === item.id && 'bg-accent text-primary',
                )}
              >
                <item.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                {item.label}
              </button>
            ))}
            <Separator className="my-2" />
            <button
              type="button"
              onClick={() => { setMoreOpen(false); onLogout(); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-5" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
