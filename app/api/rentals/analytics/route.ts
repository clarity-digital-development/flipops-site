import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * GET /api/rentals/analytics
 * Calculate portfolio-wide cash flow analytics
 * Returns:
 * - totalProperties: number of rental properties
 * - totalMonthlyRent: sum of all monthly rents
 * - totalMonthlyExpenses: sum of all monthly expenses
 * - totalMonthlyIncome: total monthly rent collected
 * - totalCashFlow: monthly cash flow (income - expenses)
 * - avgCapRate: average cap rate across all properties
 * - avgOccupancyRate: average occupancy rate
 * - vacantProperties: number of vacant properties
 * - leasedProperties: number of leased properties
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    // Get all rentals for user
    const rentals = await prisma.rental.findMany({
      where: { userId },
      include: {
        income: true,
        expenses: true,
      },
    });

    if (rentals.length === 0) {
      return NextResponse.json({
        totalProperties: 0,
        totalMonthlyRent: 0,
        totalMonthlyExpenses: 0,
        totalIncome: 0,
        totalExpenses: 0,
        totalCashFlow: 0,
        avgCapRate: 0,
        avgOccupancyRate: 0,
        vacantProperties: 0,
        leasedProperties: 0,
        totalPortfolioValue: 0,
      });
    }

    // Calculate totals
    const totalProperties = rentals.length;
    const totalMonthlyRent = rentals.reduce((sum, r) => sum + r.monthlyRent, 0);

    // Calculate monthly expenses per property
    const totalMonthlyExpenses = rentals.reduce((sum, r) => {
      const expenses =
        (r.mortgagePayment || 0) +
        (r.propertyTax || 0) +
        (r.insurance || 0) +
        (r.hoa || 0) +
        (r.utilities || 0) +
        (r.maintenance || 0);
      return sum + expenses;
    }, 0);

    // Total income and expenses collected
    const totalIncome = rentals.reduce((sum, r) => sum + r.totalIncome, 0);
    const totalExpenses = rentals.reduce((sum, r) => sum + r.totalExpenses, 0);

    // Monthly cash flow
    const totalCashFlow = totalMonthlyRent - totalMonthlyExpenses;

    // Calculate cap rate (average across properties)
    // Cap Rate = (Annual Net Operating Income / Purchase Price) * 100
    const capRates = rentals
      .filter(r => r.purchasePrice && r.purchasePrice > 0)
      .map(r => {
        const annualIncome = r.monthlyRent * 12;
        const annualExpenses = (
          ((r.propertyTax || 0) * 12) +
          ((r.insurance || 0) * 12) +
          ((r.hoa || 0) * 12) +
          ((r.utilities || 0) * 12) +
          ((r.maintenance || 0) * 12)
        ); // Exclude mortgage from NOI
        const noi = annualIncome - annualExpenses;
        return (noi / r.purchasePrice!) * 100;
      });

    const avgCapRate = capRates.length > 0
      ? capRates.reduce((sum, rate) => sum + rate, 0) / capRates.length
      : 0;

    // Calculate average occupancy rate
    const avgOccupancyRate = rentals.reduce((sum, r) => sum + r.occupancyRate, 0) / rentals.length;

    // Count properties by status
    const vacantProperties = rentals.filter(r => r.status === 'vacant').length;
    const leasedProperties = rentals.filter(r => r.status === 'leased').length;

    // Total portfolio value
    const totalPortfolioValue = rentals.reduce((sum, r) => sum + (r.purchasePrice || 0), 0);

    // Cash-on-cash return (for properties with purchase price)
    const cashOnCashReturns = rentals
      .filter(r => r.purchasePrice && r.purchasePrice > 0)
      .map(r => {
        const annualCashFlow = (r.monthlyRent * 12) - (
          ((r.mortgagePayment || 0) * 12) +
          ((r.propertyTax || 0) * 12) +
          ((r.insurance || 0) * 12) +
          ((r.hoa || 0) * 12) +
          ((r.utilities || 0) * 12) +
          ((r.maintenance || 0) * 12)
        );
        return (annualCashFlow / r.purchasePrice!) * 100;
      });

    const avgCashOnCashReturn = cashOnCashReturns.length > 0
      ? cashOnCashReturns.reduce((sum, rate) => sum + rate, 0) / cashOnCashReturns.length
      : 0;

    return NextResponse.json({
      totalProperties,
      totalMonthlyRent,
      totalMonthlyExpenses,
      totalIncome,
      totalExpenses,
      totalCashFlow,
      avgCapRate,
      avgOccupancyRate,
      vacantProperties,
      leasedProperties,
      totalPortfolioValue,
      avgCashOnCashReturn,
    });
  } catch (error) {
    console.error('Error calculating analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
