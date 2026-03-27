import Link from 'next/link';
import { Metadata } from 'next';
import { Clock, ArrowLeft, BookOpen } from 'lucide-react';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'MAO Calculator: How to Never Overpay for a Property Again | FlipOps Blog',
  description:
    'A step-by-step guide to the Maximum Allowable Offer formula and how to adjust it for your market.',
};

export default function MaoCalculatorPage() {
  return (
    <>
      <Header />
      <main className="bg-[#f4f4f6] dark:bg-black min-h-screen">
        <section className="pt-32 pb-10">
          <div className="container mx-auto px-4 max-w-3xl">
            <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
              <Link href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-gray-900 dark:hover:text-white transition-colors">Blog</Link>
              <span>/</span>
              <span className="text-gray-900 dark:text-white truncate">MAO Calculator: How to Never Overpay</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Guides</span>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                March 27, 2026
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <BookOpen className="w-3.5 h-3.5" />
                10 min read
              </div>
            </div>
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Deal Analysis', 'Fix & Flip', 'Wholesaling'].map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
              MAO Calculator: How to Never Overpay for a Property Again
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed border-l-4 border-emerald-500 pl-5">
              A step-by-step guide to the Maximum Allowable Offer formula and how to adjust it for your market.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
              By <span className="font-medium text-gray-700 dark:text-gray-300">FlipOps Team</span>
            </p>
          </div>
        </section>

        <section className="pb-20">
          <div className="container mx-auto px-4 max-w-3xl">
            <article className="prose prose-gray dark:prose-invert prose-lg max-w-none
              prose-headings:font-bold prose-headings:tracking-tight
              prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-5
              prose-strong:text-gray-900 dark:prose-strong:text-white
              prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
              prose-ul:my-4 prose-li:my-1
            ">
              <p>
                You&apos;ve found a distressed property. The owner&apos;s motivated. The numbers look decent on the surface. You want to make an offer. But how much is too much? At what price does this deal stop being profitable?
              </p>
              <p>
                That&apos;s what <strong>Maximum Allowable Offer (MAO)</strong> answers. It&apos;s the ceiling price — the highest you can pay for a property while still hitting your profit target. Go above MAO, and you&apos;re either eating into margin or making a deal that won&apos;t work. Get MAO right, and you know exactly what to bid without leaving money on the table or overpaying for deals that look good until you dig into the numbers.
              </p>
              <p>This guide walks you through the formula, shows you how to calculate it with real numbers, and explains when to adjust your approach for different market conditions.</p>

              <h2>What Is MAO and Why It Matters</h2>
              <p>
                Real estate investing has two moving parts: acquisition cost and exit value. Your profit is the gap between them, minus all the expenses in between.
              </p>
              <p><strong>Maximum Allowable Offer is the price that keeps that gap profitable.</strong></p>
              <p>
                If a property&apos;s after-repair value (ARV) is $300,000 and rehab costs are $50,000, you can&apos;t pay $300,000 for the property and still make money. You need to leave room for your profit, for carrying costs while you renovate, for selling costs when you exit. MAO tells you where that line is.
              </p>
              <p>
                Without a calculated MAO, you&apos;re guessing. And guessing leads to overpaid deals, slim or negative margins, and projects that tie up cash without returning enough profit to justify the risk.
              </p>

              <h2>The Simple Formula: The 70% Rule</h2>
              <p>The easiest version of MAO is the 70% rule:</p>
              <p><strong>MAO = (ARV × 0.70) - Rehab Costs - Your Fee</strong></p>
              <p>Here&apos;s what each piece means:</p>
              <ul>
                <li><strong>ARV (After-Repair Value):</strong> What the property will be worth after you finish renovations, estimated by comparable recent sales of similar properties in the same neighborhood.</li>
                <li><strong>0.70 (the 70% rule):</strong> This accounts for all costs between purchase and sale (carrying costs, holding period interest, selling realtor fees, closing costs, etc.) and includes a buffer for your profit. It&apos;s intentionally conservative.</li>
                <li><strong>Rehab Costs:</strong> Your total estimate for labor, materials, permits, and contractor overhead to bring the property to market condition.</li>
                <li><strong>Your Fee:</strong> Your acquisition cost plus the profit margin you need to justify the deal and your time.</li>
              </ul>

              <h3>Example: The 70% Rule in Action</h3>
              <p>Let&apos;s say you&apos;re analyzing a single-family home in an okay neighborhood.</p>
              <ul>
                <li>Recent comparable sales average $250,000 (ARV estimate)</li>
                <li>Your rehab contractor estimates $40,000 in renovations</li>
                <li>You want a $20,000 fee for sourcing, underwriting, and managing the project</li>
              </ul>
              <p>
                <strong>MAO = ($250,000 × 0.70) - $40,000 - $20,000</strong><br />
                <strong>MAO = $175,000 - $40,000 - $20,000</strong><br />
                <strong>MAO = $115,000</strong>
              </p>
              <p>
                In this example, your maximum offer is $115,000. If the seller asks for $130,000, the deal doesn&apos;t work — not at your target margin. If the seller will take $105,000, you&apos;re in the money.
              </p>

              <h2>The Detailed Formula: When to Get Granular</h2>
              <p>The 70% rule works for quick screening, but it can hide problems. A more detailed calculation gives you better precision, especially on bigger deals or in unfamiliar markets:</p>
              <p><strong>MAO = ARV - Rehab - Buying Costs - Selling Costs - Holding Costs - Desired Profit</strong></p>
              <p><strong>Buying Costs:</strong> Title insurance, appraisal, inspection, lawyer fees, deed recording. Usually 1–3% of purchase price.</p>
              <p><strong>Selling Costs:</strong> Realtor commission (typically 5–6%), title insurance, closing costs, any credits to the buyer. Usually 8–10% of sale price.</p>
              <p><strong>Holding Costs:</strong> Mortgage interest, property taxes, insurance, HOA fees, and utilities while you own the property. Calculate this based on your estimated renovation timeline.</p>
              <p><strong>Desired Profit:</strong> Your target margin. For fix-and-flip, this is usually $20,000–50,000 depending on property size and market.</p>

              <h3>Example: The Detailed Calculation</h3>
              <p>Using the same property:</p>
              <ul>
                <li>ARV: $250,000</li>
                <li>Rehab: $40,000</li>
                <li>Buying costs (2% of $120,000 offer): $2,400</li>
                <li>Selling costs (8% of $250,000 ARV): $20,000</li>
                <li>Holding costs (4-month timeline, 6% rate): $2,400</li>
                <li>Desired profit: $25,000</li>
              </ul>
              <p>
                <strong>MAO = $250,000 - $40,000 - $2,400 - $20,000 - $2,400 - $25,000 = $160,200</strong>
              </p>
              <p>With the detailed method, your MAO is $160,200 — higher than the 70% rule&apos;s $115,000 because you&apos;ve accounted for actual costs instead of a blanket percentage. Both are valid. The 70% rule is conservative (safer). The detailed calculation is precise but requires accurate cost estimates.</p>

              <h2>Getting ARV Right: The Most Critical Input</h2>
              <p>Your MAO is only as good as your ARV estimate. Overestimate ARV, and you overpay for the property. Underestimate it, and you leave money on the table or walk away from deals you should have taken.</p>
              <p><strong>How to find accurate ARV:</strong></p>
              <ol>
                <li><strong>Pull recent sales:</strong> Use MLS or county records to find homes sold within the last 90 days (or 6 months in slow markets).</li>
                <li><strong>Match on key factors:</strong> Same neighborhood, similar square footage (within 10–15%), same number of beds/baths, similar lot size.</li>
                <li><strong>Adjust for differences:</strong> If your comps sold for $245K–255K but one is 200 sq ft bigger, reduce that comp&apos;s value proportionally.</li>
                <li><strong>Average the comparable sales:</strong> Don&apos;t use the highest comp. Use the middle or average of the three to five most relevant sales.</li>
              </ol>
              <p><strong>Common mistake:</strong> Investors use the highest comparable sale as their ARV to justify a higher offer. That&apos;s backwards. Use the realistic average, then subtract your required margin.</p>

              <h2>When to Adjust the Percentage</h2>
              <p><strong>Competitive Markets:</strong> You might need to push to 75% or even 80% of ARV to win a bidding war. Understand that this shrinks your margin significantly.</p>
              <p><strong>Slower Markets:</strong> You can afford to be more conservative. 65% or lower gives you a bigger buffer for cost overruns or market downturns.</p>
              <p><strong>Wholesale Deals:</strong> If you&apos;re buying to wholesale, your profit is smaller but your holding period is days, not months. You can operate on lower margins because holding costs are minimal.</p>
              <p><strong>Rental Acquisitions:</strong> Don&apos;t use the 70% rule at all. Use a cap rate or cash-on-cash return target instead.</p>

              <h2>Common Mistakes That Kill Deals</h2>
              <p><strong>Overestimating ARV by 10–15%.</strong> A property&apos;s highest recent comp was $260,000. You use that as ARV. Your real ARV is probably $245,000. Your calculated MAO was $130,000, but the actual profitable price is $115,000. You overpay by $15,000 — your entire margin.</p>
              <p><strong>Underestimating Rehab by 20%+.</strong> You get a contractor estimate of $35,000 but don&apos;t budget for value engineering, permit surprises, or labor inflation. Add a 10–15% contingency to contractor estimates. Get multiple bids. Itemize, don&apos;t round.</p>
              <p><strong>Forgetting Holding Costs.</strong> You calculate MAO as if you&apos;ll sell the day after renovation ends. But the property sits on the market for 45 days — another $3,000–4,000 in costs you didn&apos;t budget.</p>
              <p><strong>Using Old Comps.</strong> Pull comps quarterly. Watch market trend. Adjust ARV seasonally if you&apos;re in a market with seasonal swings.</p>

              <h2>Summary: Your MAO Checklist</h2>
              <ul>
                <li><strong>Find ARV:</strong> Pull 3–5 comparable recent sales. Average them. Use the middle value.</li>
                <li><strong>Estimate Rehab:</strong> Get contractor bids. Add 10–15% contingency.</li>
                <li><strong>Calculate Costs:</strong> Buying costs (1–3%), selling costs (8–10%), holding costs (based on timeline), your fee.</li>
                <li><strong>Apply Your Formula:</strong> Use 70% rule for speed, or detailed formula for precision.</li>
                <li><strong>Set Your Offer:</strong> Never offer above MAO. Your margin depends on it.</li>
                <li><strong>Adjust for Market:</strong> Competitive markets may require 75–80% rules. Slow markets can afford 65%.</li>
              </ul>
            </article>

            <div className="mt-16 rounded-2xl p-8 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
                Close more deals at better margins
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Automated deal analysis, distress scoring, and MAO calculations in one platform.
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-lg mx-auto">
                See how FlipOps turns leads into offers faster and smarter — without the spreadsheet gymnastics.
              </p>
              <Link href="/reserve">
                <Button size="lg" className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 text-base">
                  Reserve Your Spot
                </Button>
              </Link>
            </div>

            <div className="mt-10">
              <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to the blog
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
