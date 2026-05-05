import Link from 'next/link';
import { Metadata } from 'next';
import { Clock, ArrowLeft, BookOpen } from 'lucide-react';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'What Is ARV? How to Calculate After Repair Value for Any Real Estate Deal | FlipOps Blog',
  description:
    'After repair value (ARV) is the single most important number in any flip or wholesale deal. Here\'s how to calculate ARV accurately, avoid the mistakes that sink beginners, and use it to make smarter offers.',
};

export default function WhatIsArvPage() {
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
              <span className="text-gray-900 dark:text-white truncate">What Is ARV? How to Calculate After Repair Value for Any Real Estate Deal</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Guides</span>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                March 21, 2026
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <BookOpen className="w-3.5 h-3.5" />
                10 min read
              </div>
            </div>
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Deal Analysis', 'Beginners', 'Fix & Flip'].map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
              What Is ARV? How to Calculate After Repair Value for Any Real Estate Deal
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed border-l-4 border-emerald-500 pl-5">
              After repair value (ARV) is the single most important number in any flip or wholesale deal. Here&apos;s how to calculate ARV accurately, avoid the mistakes that sink beginners, and use it to make smarter offers.
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
                If you take one thing away from this post, let it be this: the after repair value &mdash; ARV &mdash; is the number that determines whether a deal makes money or loses it. Every offer you write, every rehab budget you build, every wholesale assignment fee you negotiate traces back to your ARV estimate.
              </p>
              <p>
                Get it right and you have a margin of safety. Get it wrong and you are underwater before you pick up a hammer.
              </p>
              <p>
                This guide breaks down what after repair value actually means, how to calculate it step by step, and where beginners consistently get it wrong.
              </p>

              <h2>What After Repair Value Actually Means</h2>
              <p>
                ARV is the estimated market value of a property after all planned repairs and renovations are complete. It is not what the property is worth today. It is not what you hope to sell it for. It is what a buyer would realistically pay for it in its fully renovated condition based on what similar renovated properties are actually selling for in the same area.
              </p>
              <p>The formula looks simple on paper:</p>
              <p><strong>ARV = Current Property Value + Value Added by Renovations</strong></p>
              <p>
                But in practice, ARV is not calculated by adding your renovation costs to the purchase price. A $30,000 kitchen remodel does not automatically add $30,000 in value. The market determines value, not your receipts. That is why the calculation is driven by comparable sales &mdash; what buyers have actually paid for similar finished properties nearby.
              </p>

              <h2>Why ARV Matters for Every Deal Type</h2>
              <p>
                Whether you are wholesaling, flipping, or buying rentals, ARV is your anchor number.
              </p>

              <h3>Wholesaling</h3>
              <p>
                You need ARV to calculate your maximum allowable offer (MAO). If your ARV is off by $20,000, your assignment fee either evaporates or the end buyer walks because the numbers do not work on their end.
              </p>

              <h3>Fix and Flip</h3>
              <p>
                Your entire profit projection depends on ARV. Rehab budget, holding costs, agent commissions, closing costs &mdash; they all get subtracted from ARV to determine your net profit. An inflated ARV means an inflated sense of profit that does not exist.
              </p>

              <h3>Buy and Hold</h3>
              <p>
                Even rental investors use ARV when acquiring distressed properties below market value. The spread between purchase price and ARV represents your built-in equity, which matters for refinancing (the BRRRR strategy) and portfolio lending.
              </p>

              <h2>How to Calculate ARV Step by Step</h2>

              <h3>Step 1: Define Your Renovation Scope</h3>
              <p>
                Before you look at comps, you need to know what &ldquo;after repair&rdquo; actually looks like for this specific property. Are you doing a cosmetic refresh (paint, flooring, fixtures) or a full gut renovation (new roof, HVAC, electrical, layout changes)?
              </p>
              <p>
                The scope of your renovation determines which comps are relevant. A property getting a $15,000 cosmetic update should not be compared against fully gutted, high-end remodels selling at a premium.
              </p>
              <p>
                Write down every planned repair. Be specific. This list will guide your comp selection.
              </p>

              <h3>Step 2: Pull Comparable Sales</h3>
              <p>
                This is where ARV is actually determined. You need to find 3 to 6 properties that meet these criteria:
              </p>
              <ul>
                <li><strong>Sold within the last 90 days.</strong> Six months maximum in slower markets, but recent sales are always more reliable.</li>
                <li><strong>Within 1 mile of your subject property.</strong> Tighter is better. Half a mile or the same subdivision is ideal. In rural areas you may need to expand to 3 miles.</li>
                <li><strong>Similar size.</strong> Within 200 to 300 square feet of your subject property. A 1,200 square foot house is not comparable to a 2,000 square foot house, even on the same street.</li>
                <li><strong>Similar age and construction.</strong> A 1960s ranch is not comparable to a 2015 new build, even if they are the same square footage.</li>
                <li><strong>Similar condition post-renovation.</strong> This is the part beginners miss. Your comps need to reflect the finished condition your property will be in. If you are doing builder-grade finishes, do not use comps with quartz countertops and custom cabinetry.</li>
              </ul>
              <p>
                Where to find comps: MLS access through an agent is the gold standard. Zillow, Redfin, and Realtor.com show sold data but sometimes lag. County assessor records show recorded sale prices. PropStream and similar investor tools aggregate this data with filters built for investors.
              </p>

              <h3>Step 3: Calculate Price Per Square Foot</h3>
              <p>
                Take each comp&apos;s sale price and divide by its square footage. This gives you a normalized metric you can apply to your subject property.
              </p>
              <p>Example:</p>
              <ul>
                <li>Comp 1: Sold $285,000 / 1,400 sq ft = $203.57/sq ft</li>
                <li>Comp 2: Sold $278,000 / 1,350 sq ft = $205.93/sq ft</li>
                <li>Comp 3: Sold $292,000 / 1,425 sq ft = $204.91/sq ft</li>
              </ul>
              <p>Average price per square foot: $204.80</p>

              <h3>Step 4: Apply to Your Subject Property</h3>
              <p>
                Multiply the average price per square foot by your subject property&apos;s square footage.
              </p>
              <p>If your subject property is 1,380 square feet:</p>
              <p><strong>ARV = $204.80 &times; 1,380 = $282,624</strong></p>
              <p>
                Most investors round to the nearest $5,000 or $10,000 &mdash; so your working ARV would be approximately $280,000 to $285,000.
              </p>

              <h3>Step 5: Adjust for Property-Specific Differences</h3>
              <p>No comp is a perfect match. Adjust for meaningful differences:</p>
              <ul>
                <li><strong>Extra bedroom or bathroom:</strong> Can add $10,000 to $25,000 depending on the market.</li>
                <li><strong>Garage vs. no garage:</strong> Significant in suburbs, less so in urban areas.</li>
                <li><strong>Lot size:</strong> Matters more in some markets than others.</li>
                <li><strong>Location within the neighborhood:</strong> Corner lots, busy roads, or backing to commercial property can reduce value.</li>
              </ul>
              <p>
                These adjustments should be small and defensible. If you find yourself making $40,000 in adjustments to make a comp work, it is not a good comp.
              </p>

              <h2>The 70% Rule: Turning ARV Into an Offer</h2>
              <p>Once you have your ARV, the industry standard formula for a maximum offer is:</p>
              <p><strong>Maximum Allowable Offer (MAO) = (ARV &times; 0.70) &minus; Repair Costs</strong></p>
              <p>Using the example above:</p>
              <ul>
                <li>ARV: $282,000</li>
                <li>Estimated repairs: $35,000</li>
                <li>MAO: ($282,000 &times; 0.70) &minus; $35,000 = <strong>$162,400</strong></li>
              </ul>
              <p>
                The 30% margin accounts for holding costs, closing costs, agent commissions, and profit. Some experienced investors use 75% in hot markets or 65% in slow ones, but 70% is the starting point for a reason &mdash; it gives you room to be wrong on your ARV or repair estimate without losing money.
              </p>

              <h2>The 5 Most Common ARV Mistakes Beginners Make</h2>

              <h3>1. Using Active Listings as Comps</h3>
              <p>
                Listings are asking prices, not sale prices. A property listed at $300,000 that sells at $270,000 will wreck your ARV if you used the list price. Only use sold comps.
              </p>

              <h3>2. Cherry-Picking the Highest Comps</h3>
              <p>
                It is tempting to grab the three highest sales in the area to justify a higher ARV. Resist this. Use a representative range. If you cannot find three solid comps that support your number, the number is probably wrong.
              </p>

              <h3>3. Ignoring Condition Differences</h3>
              <p>
                A comp that sold with a new roof, new HVAC, and hardwood floors is not comparable to your property that will have patched shingles and vinyl plank. Match the renovation level.
              </p>

              <h3>4. Pulling Comps From Too Far Away</h3>
              <p>
                Different neighborhoods in the same zip code can have wildly different values. Stay tight geographically. Cross a major road or school district boundary and you might be in a different market.
              </p>

              <h3>5. Not Accounting for Market Movement</h3>
              <p>
                In appreciating markets, comps from 6 months ago may understate current values. In declining markets, they overstate them. Weight recent comps more heavily and know the direction your market is moving.
              </p>

              <h2>How FlipOps Approaches ARV</h2>
              <p>
                Most investor tools give you raw property data and leave comp analysis to manual spreadsheet work. FlipOps is building comp analysis directly into the deal evaluation workflow &mdash; so that when you pull a property, you see relevant sold comparables filtered for condition, proximity, and recency alongside your deal numbers. The goal is to make ARV calculation faster and harder to get wrong.
              </p>
              <p>
                Combined with distress scoring that identifies which properties are actually likely to sell at a discount, you spend less time running comps on deals that were never going to close and more time on the ones that will.
              </p>

              <h2>The Bottom Line</h2>
              <p>
                After repair value is not a guess. It is a discipline. The investors who consistently make money on flips and wholesale deals are the ones who run comps methodically, stay conservative on adjustments, and resist the urge to inflate their numbers to justify a deal they want to do.
              </p>
              <p>
                If the ARV does not support the deal at 70%, walk away. There will be another one. The investors who get in trouble are the ones who bend their ARV to fit their offer instead of the other way around.
              </p>
            </article>

            <div className="mt-16 rounded-2xl p-8 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
                Stop guessing on ARV
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Run deal numbers with real data, not spreadsheet math.
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-lg mx-auto">
                FlipOps integrates comp analysis and distress scoring directly into your deal evaluation workflow &mdash; so the next acquisition is grounded in numbers you can defend.
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
