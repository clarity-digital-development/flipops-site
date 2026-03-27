import Link from 'next/link';
import { Metadata } from 'next';
import { Clock, ArrowLeft, BookOpen } from 'lucide-react';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: "How to Analyze a Real Estate Deal: The No-Guesswork Guide for First-Time Investors | FlipOps Blog",
  description:
    "Learn how to analyze a real estate deal from scratch — ARV, repair estimates, the 70% rule, and the exact numbers you need to run before making an offer.",
};

export default function HowToAnalyzeDealPage() {
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
              <span className="text-gray-900 dark:text-white truncate">How to Analyze a Real Estate Deal</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Guides</span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">Beginner</span>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                March 18, 2026
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <BookOpen className="w-3.5 h-3.5" />
                10 min read
              </div>
            </div>

            <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
              How to Analyze a Real Estate Deal: The No-Guesswork Guide for First-Time Investors
            </h1>

            <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed border-l-4 border-emerald-500 pl-5">
              Learn how to analyze a real estate deal from scratch — ARV, repair estimates, the 70%
              rule, and the exact numbers you need to run before making an offer.
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
              prose-ol:my-4
            ">

              <p>
                Every new real estate investor hits the same wall. You find a property that looks like
                it could be a deal, but you have no idea whether the numbers actually work. You stare
                at a listing, guess at repair costs, and either lowball so aggressively you never get
                a contract or overpay and learn an expensive lesson. Learning how to analyze a real
                estate deal properly is the single most important skill you&apos;ll develop as an
                investor — and it&apos;s more straightforward than most gurus make it sound.
              </p>

              <p>
                This guide walks through the exact process, step by step, whether you&apos;re
                evaluating your first wholesale deal or your first flip.
              </p>

              <h2>Start With the End: What Is After Repair Value (ARV)?</h2>

              <p>
                Before you can figure out what to offer on a property, you need to know what it will
                be worth after it&apos;s fixed up. That number is called the After Repair Value, or
                ARV, and it&apos;s the foundation of every deal analysis.
              </p>

              <p>
                ARV isn&apos;t a guess and it isn&apos;t a Zillow estimate. You calculate it by
                looking at comparable sales — properties similar to yours in size, condition,
                location, and style that have sold recently. &quot;Recently&quot; means within the
                last 3–6 months. &quot;Similar&quot; means within a quarter mile if you&apos;re in a
                dense area, or within a mile in suburban or rural markets.
              </p>

              <h3>How to Pull Comps</h3>

              <p>Here&apos;s the process:</p>

              <ol>
                <li><strong>Identify the subject property&apos;s key specs:</strong> square footage, bedroom/bathroom count, lot size, year built, and what it would look like fully renovated</li>
                <li><strong>Search for recently sold properties</strong> that match those specs as closely as possible. You can use the MLS (if you have access through an agent), county records, or a data platform like PropStream or FlipOps</li>
                <li><strong>Filter for condition:</strong> You want comps that are in renovated or retail-ready condition, since that&apos;s what your property will look like after rehab</li>
                <li><strong>Pull 3–5 solid comps</strong> and average their sale prices. Throw out outliers — the one that sold for $50K above everything else because the buyer was desperate, or the one that went cheap because it was a foreclosure fire sale</li>
              </ol>

              <p>
                That average is your ARV. Be conservative. If your comps suggest a range of $180K to
                $210K, don&apos;t use $210K as your ARV. Use $190K or $195K. Optimism is the most
                expensive emotion in real estate investing.
              </p>

              <h2>Estimate Your Repair Costs</h2>

              <p>
                This is where beginners get into the most trouble. Underestimating repairs is the
                number one reason first-time flippers lose money.
              </p>

              <p>Repair costs fall into three broad tiers:</p>

              <h3>Light Rehab ($10–$20 per square foot)</h3>

              <p>
                Paint, landscaping, minor cosmetic updates. The property is structurally sound and
                functionally fine — it just looks dated or neglected. Think carpet replacement, fresh
                paint inside and out, basic fixture updates, and curb appeal cleanup.
              </p>

              <h3>Medium Rehab ($20–$35 per square foot)</h3>

              <p>
                Everything in light rehab plus kitchen and bathroom updates, new flooring throughout,
                new fixtures (plumbing and lighting), possibly new windows and doors. The property
                functions but needs significant cosmetic and functional work.
              </p>

              <h3>Heavy Rehab ($35–$60+ per square foot)</h3>

              <p>
                Full gut renovation. Foundation issues, roof replacement, HVAC replacement, electrical
                rewiring, plumbing overhaul, plus all the cosmetic work on top. These are the
                properties that look like they haven&apos;t been maintained in decades.
              </p>

              <p>
                If you&apos;re brand new, do not start with heavy rehabs. Stick to light and medium
                until you have a reliable contractor network and enough experience to spot hidden
                problems.
              </p>

              <h3>Getting Better at Estimates</h3>

              <p>
                Walk the property. Every room. Open every cabinet. Check the roof, the foundation,
                the electrical panel, and the water heater. Take photos of everything.
              </p>

              <p>
                Then run your per-square-foot estimate based on which tier the property falls into. A
                1,200 square foot house that needs a medium rehab: 1,200 × $25 = $30,000 as a
                starting estimate. Add a 10–15% contingency buffer for the things you didn&apos;t see
                or didn&apos;t know to look for. Your working repair number is now $33,000–$34,500.
              </p>

              <p>
                As you do more deals, you&apos;ll replace per-square-foot estimates with line-item
                budgets — actual costs for each scope of work. But the per-square-foot method gives
                you a defensible starting point.
              </p>

              <h2>The 70% Rule: Your Offer Formula</h2>

              <p>
                Now that you have your ARV and your repair estimate, you can calculate your Maximum
                Allowable Offer (MAO). The industry standard formula is the 70% rule:
              </p>

              <p><strong>MAO = (ARV × 70%) − Repair Costs</strong></p>

              <p>If your ARV is $190,000 and your repair estimate is $33,000:</p>

              <p>
                MAO = ($190,000 × 0.70) − $33,000<br />
                MAO = $133,000 − $33,000<br />
                MAO = <strong>$100,000</strong>
              </p>

              <p>
                That means the most you should pay for this property is $100,000. The 30% margin
                covers closing costs, holding costs (insurance, taxes, loan payments while you own the
                property), selling costs (agent commissions, concessions), and your profit.
              </p>

              <h3>Why 70% and Not 80%?</h3>

              <p>
                New investors often feel like the 70% rule is too conservative and they&apos;ll never
                get a deal under contract. The temptation to bump it to 75% or 80% is real. Resist
                it.
              </p>

              <p>
                That 30% buffer exists because real estate deals rarely go exactly as planned. Repairs
                run over budget. The property takes longer to sell than you expected. Interest rates
                shift and your buyer pool shrinks. The 70% rule isn&apos;t just about profit — it&apos;s
                about survival. Deals analyzed at 80% of ARV leave almost no room for error, and
                errors are inevitable when you&apos;re starting out.
              </p>

              <p>
                If you&apos;re wholesaling rather than flipping, you also need to subtract your
                assignment fee from the MAO. If you want a $10,000 assignment fee, your offer price
                drops to $90,000 in the example above. You need to leave enough margin for the end
                buyer (typically a flipper) to hit their own 70% rule.
              </p>

              <h2>Run the Deal Through a Sanity Check</h2>

              <p>Before you make an offer, pressure-test your numbers:</p>

              <h3>Check 1: Are your comps actually comparable?</h3>

              <p>
                Did you use properties of similar size, age, and style? Are they in the same
                neighborhood or a neighborhood with similar price dynamics? If your best comp is 2
                miles away and 500 square feet larger, your ARV estimate is weak.
              </p>

              <h3>Check 2: Are your repair estimates realistic?</h3>

              <p>
                If you haven&apos;t walked the property, your estimate is a guess. If you&apos;ve
                walked it but you&apos;ve never renovated a property, get a second opinion from a
                contractor. Better yet, get two.
              </p>

              <h3>Check 3: Does the deal work at a lower ARV?</h3>

              <p>
                Run the numbers with your ARV reduced by 5–10%. If the deal still works, it&apos;s
                solid. If a 5% ARV drop turns your profit into a loss, the deal is too thin.
              </p>

              <h3>Check 4: Have you accounted for holding costs?</h3>

              <p>
                Every month you own a property costs money — insurance, taxes, utilities, loan
                payments. If your flip takes 6 months instead of 3, that&apos;s 3 extra months of
                holding costs eating into your profit. Budget for it.
              </p>

              <h2>How to Analyze a Real Estate Deal in Under 10 Minutes</h2>

              <p>Once you&apos;ve done this a few times, the process gets fast. Here&apos;s the rapid version:</p>

              <ol>
                <li><strong>Pull comps and estimate ARV</strong> — 3 minutes if you have a good data source</li>
                <li><strong>Estimate rehab tier and calculate repair costs</strong> — 2 minutes for a drive-by or photo assessment, more for a walkthrough</li>
                <li><strong>Run the 70% rule</strong> — 30 seconds with a calculator</li>
                <li><strong>Sanity check comps and repair assumptions</strong> — 2 minutes</li>
                <li><strong>Decide: make an offer or move on</strong> — 1 minute</li>
              </ol>

              <p>
                The biggest time sink for beginners isn&apos;t the analysis itself — it&apos;s finding
                reliable data. If you&apos;re spending 30 minutes per property just trying to pull
                comps and ownership info from multiple sources, your bottleneck isn&apos;t your deal
                analysis skill. It&apos;s your tools.
              </p>

              <h2>Common Mistakes That Kill First Deals</h2>

              <p>
                <strong>Using Zillow or Redfin estimates as ARV.</strong> Automated valuation models
                are starting points at best. They don&apos;t account for condition, renovation
                quality, or hyper-local pricing dynamics. Always use actual sold comps.
              </p>

              <p>
                <strong>Ignoring holding costs.</strong> A deal that looks profitable on a napkin
                calculation falls apart when you add 4–6 months of insurance, taxes, and debt service.
                These costs are real and they compound.
              </p>

              <p>
                <strong>Falling in love with a property.</strong> The numbers either work or they
                don&apos;t. If you find yourself rationalizing why this particular deal is an
                exception to the 70% rule, walk away. There will be another deal.
              </p>

              <p>
                <strong>Skipping the walkthrough.</strong> Photos lie. Sellers lie. Even
                well-intentioned sellers don&apos;t know about the mold behind the drywall or the
                cracked sewer line. Never underwrite a deal you haven&apos;t physically inspected or
                had someone you trust inspect.
              </p>

              <h2>Start Running Numbers Today</h2>

              <p>
                The best way to get better at analyzing real estate deals is to analyze a lot of them.
                Pull up properties in your target market and run the numbers — even on deals you have
                no intention of pursuing. Practice estimating ARV from comps, practice categorizing
                rehab tiers, practice running the 70% rule until it&apos;s automatic.
              </p>

              <p>
                Within 30–60 days of daily practice, you&apos;ll be able to glance at a property and
                know within minutes whether it&apos;s worth pursuing. That speed is what separates
                investors who close deals from those who are still watching YouTube videos about it.
              </p>

            </article>

            <div className="mt-16 rounded-2xl p-8 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
                Analyze deals faster
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Property data, comps, and pipeline in one place.
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-lg mx-auto">
                FlipOps streamlines your entire deal analysis workflow — so you spend less time
                hunting for data and more time closing deals.
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
