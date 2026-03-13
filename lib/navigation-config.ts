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
  // Hybrid users see everything
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

    // Check if user's investor type is in the visibleTo array
    return item.visibleTo.includes(investorType) || item.visibleTo.includes('hybrid');
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
        if (!entry.visibleTo.includes(investorType) && !entry.visibleTo.includes('hybrid')) return null;
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
