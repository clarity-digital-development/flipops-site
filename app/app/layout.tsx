"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { QuickAddLead } from "@/app/components/quick-add-lead";
import {
  Home,
  Users,
  MessageSquare,
  Phone,
  Calculator,
  UserCheck,
  CheckSquare,
  Briefcase,
  FileText,
  BarChart,
  Settings,
  Menu,
  X,
  Search,
  Bell,
  FileSignature,
  Hammer,
  Building2,
  ChevronDown,
  Send,
  GitBranch,
  HardHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { ErrorBoundary } from "@/app/components/error-boundary";
import {
  filterSidebarByInvestorType,
  isNavGroup,
  NAVIGATION_RULES,
  type InvestorType,
  type NavigationItem,
  type NavigationGroup,
  type SidebarEntry,
} from "@/lib/navigation-config";

// ============================================================================
// SIDEBAR STRUCTURE
// ============================================================================

// Sidebar reflects the deal pipeline flow, top → bottom:
// Overview → Leads (All Leads + Underwriting) → Outreach → Deal Execution → Post-Close → Workspace → Analytics
const baseSidebar: SidebarEntry[] = [
  { name: "Overview", href: "/app", icon: Home },
  {
    name: "Leads",
    icon: Users,
    children: [
      { name: "All Leads", href: "/app/leads", icon: Users },
      { name: "Underwriting", href: "/app/underwriting", icon: Calculator },
    ],
  },
  {
    name: "Outreach",
    icon: Send,
    children: [
      { name: "Inbox", href: "/app/inbox", icon: MessageSquare },
      { name: "Dialer", href: "/app/dialer", icon: Phone },
    ],
  },
  {
    name: "Deal Execution",
    icon: GitBranch,
    children: [
      { name: "Offers", href: "/app/offers", icon: FileText },
      { name: "Contracts", href: "/app/contracts", icon: FileSignature },
      { name: "Buyers", href: "/app/buyers", icon: UserCheck, visibleTo: NAVIGATION_RULES['Buyers'] },
    ],
  },
  {
    name: "Post-Close",
    icon: HardHat,
    children: [
      { name: "Renovations", href: "/app/renovations", icon: Hammer, visibleTo: NAVIGATION_RULES['Renovations'] },
      { name: "Rentals", href: "/app/rentals", icon: Building2, visibleTo: NAVIGATION_RULES['Rentals'] },
    ],
  },
  {
    name: "Workspace",
    icon: Briefcase,
    children: [
      { name: "Vendors", href: "/app/vendors", icon: Briefcase },
      { name: "Tasks", href: "/app/tasks", icon: CheckSquare },
      { name: "Documents", href: "/app/documents", icon: FileText },
    ],
  },
  { name: "Analytics", href: "/app/analytics", icon: BarChart },
];

// ============================================================================
// NAV GROUP COMPONENT
// ============================================================================

function NavGroup({
  group,
  pathname,
  openGroups,
  onToggle,
}: {
  group: NavigationGroup;
  pathname: string;
  openGroups: Set<string>;
  onToggle: (name: string) => void;
}) {
  const isOpen = openGroups.has(group.name);
  const hasActiveChild = group.children.some(
    (child) => pathname === child.href || (child.href !== "/app" && pathname?.startsWith(child.href))
  );
  const Icon = group.icon;

  return (
    <div>
      {/* Group toggle button */}
      <button
        onClick={() => onToggle(group.name)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full",
          hasActiveChild
            ? "text-gray-900 dark:text-white"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50"
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="flex-1 text-left">{group.name}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Children with animated height */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="mt-0.5 space-y-0.5 pl-4">
          {group.children.map((child) => {
            const isActive =
              pathname === child.href ||
              (child.href !== "/app" && pathname?.startsWith(child.href));
            const ChildIcon = child.icon;

            return (
              <Link
                key={child.name}
                href={child.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50"
                )}
              >
                <ChildIcon className="h-4 w-4" />
                {child.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LAYOUT
// ============================================================================

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const [quickAddLeadOpen, setQuickAddLeadOpen] = useState(false);
  const [investorType, setInvestorType] = useState<InvestorType>(null);
  const [sidebar, setSidebar] = useState<SidebarEntry[]>(baseSidebar);
  const [isMounted, setIsMounted] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Set mounted state to prevent SSR of Clerk components
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch user profile to get investor type
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const data = await response.json();
          const userInvestorType = data.user?.investorType as InvestorType;
          setInvestorType(userInvestorType);

          // Filter sidebar based on investor type
          const filteredSidebar = filterSidebarByInvestorType(baseSidebar, userInvestorType);
          setSidebar(filteredSidebar);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setSidebar(baseSidebar);
      }
    };

    fetchUserProfile();
  }, []);

  // Auto-open groups that contain the active route
  useEffect(() => {
    const activeGroups = new Set<string>();
    for (const entry of sidebar) {
      if (isNavGroup(entry)) {
        const hasActive = entry.children.some(
          (child) => pathname === child.href || (child.href !== "/app" && pathname?.startsWith(child.href))
        );
        if (hasActive) {
          activeGroups.add(entry.name);
        }
      }
    }
    // Merge with existing open groups (don't close user-opened ones)
    setOpenGroups((prev) => {
      const merged = new Set(prev);
      for (const g of activeGroups) merged.add(g);
      return merged;
    });
  }, [pathname, sidebar]);

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Don't render layout until mounted to prevent Clerk SSR errors
  if (!isMounted) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-black">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-[#2a2a2a] transform transition-transform lg:transform-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-[#2a2a2a]">
            <Link href="/app" className="flex items-center">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                FlipOps
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {sidebar.map((entry) => {
              if (isNavGroup(entry)) {
                return (
                  <NavGroup
                    key={entry.name}
                    group={entry}
                    pathname={pathname}
                    openGroups={openGroups}
                    onToggle={toggleGroup}
                  />
                );
              }

              const item = entry as NavigationItem;
              const isActive = pathname === item.href ||
                (item.href !== "/app" && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section: Settings + User */}
          <div className="border-t border-gray-200 dark:border-[#2a2a2a] px-3 py-3 space-y-1">
            <Link
              href="/app/settings"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/app/settings" || pathname?.startsWith("/app/settings")
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50"
              )}
            >
              <Settings className="h-5 w-5" />
              Settings
            </Link>
            <div className="flex items-center gap-3 px-3 py-1.5">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8"
                  }
                }}
                afterSignOutUrl="/"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 dark:border-[#2a2a2a] bg-white/95 dark:bg-black/95 backdrop-blur px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Search — hidden until command palette ships (Phase 8) */}
          {/* TODO: re-enable when command palette ships. Visible non-functional
              search is worse than no search. Keep the spacer so the right-side
              actions stay flush with the right edge. */}
          <div className="flex-1 min-w-0" />

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
              onClick={() => {
                // Phase 8: /api/notifications GET requires FO_API_KEY and is
                // not user-scoped; surfacing recent notifications from the
                // browser would either leak cross-tenant data or 401. Toast
                // until a user-scoped query lands.
                toast({
                  title: "Notifications coming soon",
                  description: "Recent activity will appear here once user-scoped notifications ship.",
                });
              }}
            >
              <Bell className="h-5 w-5" />
              {/* Hardcoded unread dot removed — it was a lie. */}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setQuickAddLeadOpen(true)}
              className="hidden sm:inline-flex"
            >
              Add Lead
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 h-[calc(100dvh-4rem)] overflow-hidden">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* Quick Add Lead Modal */}
      <QuickAddLead
        open={quickAddLeadOpen}
        onOpenChange={setQuickAddLeadOpen}
      />
    </div>
  );
}
