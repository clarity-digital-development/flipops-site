/**
 * Navigation configuration and filtering based on investor type
 *
 * Investor Types:
 * - wholesaler: Focuses on buyer database, assignments, marketing
 * - flipper: Focuses on renovations, contractors, budgets
 * - buy_and_hold: Focuses on rentals, tenants, cash flow
 * - hybrid: Has access to all features
 */

export type InvestorType = 'wholesaler' | 'flipper' | 'buy_and_hold' | 'hybrid' | null;

/**
 * Default persona used when the viewer is anonymous (the pre-launch /app(.*)
 * Clerk bypass) OR is authenticated but has not yet completed onboarding
 * (investorType === null). Hybrid is the default — flippers still occasionally
 * hold a deal that doesn't sell, so we surface Buyers + Rentals + Renovations
 * in the sidebar for any user who has not explicitly declared otherwise.
 * Authenticated users with a non-hybrid investorType override this.
 *
 * Single source of truth — consumed by app/app/layout.tsx. Do not hard-code the
 * string 'flipper' elsewhere; import this constant instead.
 */
export const DEFAULT_INVESTOR_TYPE: InvestorType = 'hybrid';

export interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  indent?: boolean;
  // Which investor types can see this navigation item
  // If not specified, visible to all types
  visibleTo?: InvestorType[];
}

export interface NavigationGroup {
  name: string;
  icon: any;
  children: NavigationItem[];
}

export type SidebarEntry = NavigationItem | NavigationGroup;

export function isNavGroup(entry: SidebarEntry): entry is NavigationGroup {
  return 'children' in entry;
}

/**
 * Filter navigation items based on investor type
 * @param navigation - Array of navigation items
 * @param investorType - User's investor type
 * @returns Filtered navigation items
 */
export function filterNavigationByInvestorType(
  navigation: NavigationItem[],
  investorType: InvestorType
): NavigationItem[] {
  // Hybrid users see everything. This is the ONLY place we accept an item
  // because of the 'hybrid' literal — downstream we filter strictly by the
  // user's persona membership. See comment on the filter predicate below.
  if (investorType === 'hybrid') {
    return navigation;
  }

  // Filter based on visibleTo property
  return navigation.filter(item => {
    // If no visibleTo specified, show to everyone
    if (!item.visibleTo) {
      return true;
    }

    // If user has no investor type (shouldn't happen with onboarding guard), show core features only
    if (!investorType) {
      return !item.visibleTo; // Only items without restrictions
    }

    // Check if user's investor type is in the visibleTo array.
    // NOTE: do NOT also accept items whose visibleTo contains 'hybrid' — that
    // check is about whether the USER is hybrid (already handled by the early
    // return above), not whether the item happens to allow hybrid viewers.
    // Every persona-gated item lists 'hybrid' so hybrid users can see it, so
    // an `|| item.visibleTo.includes('hybrid')` clause here would make the
    // filter a no-op for every non-hybrid persona. This was the root cause of
    // Sam round 1-4 "Buyers + Rentals visible in flipper sidebar" finding.
    return item.visibleTo.includes(investorType);
  });
}

/**
 * Filter sidebar entries (including groups) based on investor type.
 * Groups with no visible children after filtering are removed entirely.
 */
export function filterSidebarByInvestorType(
  entries: SidebarEntry[],
  investorType: InvestorType
): SidebarEntry[] {
  return entries
    .map(entry => {
      if (isNavGroup(entry)) {
        const filteredChildren = filterNavigationByInvestorType(entry.children, investorType);
        if (filteredChildren.length === 0) return null;
        return { ...entry, children: filteredChildren } as NavigationGroup;
      }
      // Standalone item
      if (entry.visibleTo) {
        if (investorType === 'hybrid') return entry;
        if (!investorType) return null;
        // Only the user's persona membership matters here. The hybrid-user
        // case is handled by the early return above; checking whether the
        // item allows hybrid viewers would let any persona-gated item leak to
        // every persona (same bug as in filterNavigationByInvestorType).
        if (!entry.visibleTo.includes(investorType)) return null;
      }
      return entry;
    })
    .filter((e): e is SidebarEntry => e !== null);
}

/**
 * Navigation configuration with investor type visibility rules
 *
 * Core features (visible to all):
 * - Overview, Leads, Inbox, Campaigns, Underwriting, Contracts, Tasks, Vendors, Documents, Analytics, Data Sources, Settings
 *
 * Wholesaler-specific:
 * - Buyers (for building buyer database and assignments)
 *
 * Flipper-specific:
 * - Renovations (for managing rehab projects)
 *
 * Buy-and-Hold-specific:
 * - Rentals (for managing rental properties and tenants)
 */
export const NAVIGATION_RULES: Record<string, InvestorType[] | undefined> = {
  // Core features - visible to all (undefined means no restrictions)
  'Overview': undefined,
  'Leads': undefined,
  'Inbox': undefined,
  'Campaigns': undefined,
  'Underwriting': undefined,
  'Contracts': undefined,
  'Tasks': undefined,
  'Vendors': undefined,
  'Documents': undefined,
  'Analytics': undefined,
  'Data Sources': undefined,
  'Panel APIs': undefined,
  'Settings': undefined,

  // Investor-type-specific features
  // M3.5 — "Disposition" replaced the wholesaler-only "Buyers" surface as a
  // flipper-PRIMARY sell-side workspace (listing prep, agent handoff,
  // list-vs-ARV, sale-side net sheet) with the cash-buyer network demoted to a
  // tab. Sellers of every kind see it: flippers (sell post-rehab), wholesalers
  // (assign), and hybrids. Buy-and-hold holds — it uses Rentals instead. The
  // legacy 'Buyers' key is retained (harmless) in case anything still reads it.
  'Disposition': ['wholesaler', 'flipper', 'hybrid'],
  'Buyers': ['wholesaler', 'hybrid'],
  'Renovations': ['flipper', 'hybrid'],
  'Rentals': ['buy_and_hold', 'hybrid'],
};

/**
 * Get investor type display name
 */
export function getInvestorTypeDisplayName(investorType: InvestorType): string {
  switch (investorType) {
    case 'wholesaler':
      return 'Wholesaler';
    case 'flipper':
      return 'Fix & Flip';
    case 'buy_and_hold':
      return 'Buy & Hold';
    case 'hybrid':
      return 'Hybrid';
    default:
      return 'Investor';
  }
}

/**
 * Get investor type emoji
 */
export function getInvestorTypeEmoji(investorType: InvestorType): string {
  switch (investorType) {
    case 'wholesaler':
      return '🔄';
    case 'flipper':
      return '🔨';
    case 'buy_and_hold':
      return '🏠';
    case 'hybrid':
      return '🔀';
    default:
      return '💼';
  }
}

/**
 * Get investor type description
 */
export function getInvestorTypeDescription(investorType: InvestorType): string {
  switch (investorType) {
    case 'wholesaler':
      return 'Finding deals and assigning contracts for assignment fees';
    case 'flipper':
      return 'Buying, renovating, and selling properties for profit';
    case 'buy_and_hold':
      return 'Acquiring rental properties for long-term cash flow';
    case 'hybrid':
      return 'Multiple strategies depending on the deal';
    default:
      return 'Real estate investing';
  }
}
