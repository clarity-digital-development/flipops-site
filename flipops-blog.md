# FlipOps Blog Guide

This guide covers everything needed to add and publish blog posts on the FlipOps site.

---

## How a Published Blog Post Works

Each published post requires **two things**:

1. **A card entry** in `app/blog/page.tsx` — shows up on the blog index
2. **A full article page** at `app/blog/[slug]/page.tsx` — the full readable post

---

## Step 1 — Add the Post Card to the Blog Index

Open `app/blog/page.tsx` and add an object to the `posts` array:

```typescript
{
  title: 'Your Post Title Here',
  teaser: 'A 1–2 sentence summary shown on the card.',
  category: 'Guides',           // See available categories below
  date: 'April 2026',
  slug: 'your-post-slug',       // Must match the folder name in app/blog/
  published: true,              // Set to true when live, omit or false for "Coming Soon"
},
```

**Available categories** (controls the badge color):

| Category     | Color         |
|-------------|---------------|
| `Technology` | Blue          |
| `Strategy`   | Purple        |
| `Guides`     | Emerald/Green |
| `Data`       | Amber/Yellow  |
| `Product`    | Teal          |

---

## Step 2 — Create the Article Page

Create a new folder and file:

```
app/blog/your-post-slug/page.tsx
```

Use this template (copy and fill in the blanks):

```tsx
import Link from 'next/link';
import { Metadata } from 'next';
import { Clock, ArrowLeft, BookOpen } from 'lucide-react';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Your Post Title | FlipOps Blog',
  description: 'Your meta description (1–2 sentences, used by Google).',
};

export default function YourPostPage() {
  return (
    <>
      <Header />
      <main className="bg-[#f4f4f6] dark:bg-black min-h-screen">

        {/* Article header */}
        <section className="pt-32 pb-10">
          <div className="container mx-auto px-4 max-w-3xl">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
              <Link href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-gray-900 dark:hover:text-white transition-colors">Blog</Link>
              <span>/</span>
              <span className="text-gray-900 dark:text-white truncate">Short Title Here</span>
            </nav>

            {/* Category badges + meta */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                Guides
              </span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
                Beginner
              </span>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                April 1, 2026
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <BookOpen className="w-3.5 h-3.5" />
                10 min read
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
              Your Full Post Title Here
            </h1>

            {/* Intro / lede */}
            <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed border-l-4 border-emerald-500 pl-5">
              Your opening summary sentence or two. This appears as a highlighted callout under the title.
            </p>

            <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
              By <span className="font-medium text-gray-700 dark:text-gray-300">FlipOps Team</span>
            </p>
          </div>
        </section>

        {/* Article body */}
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

              <p>Your intro paragraph goes here.</p>

              <h2>First Section Heading</h2>

              <p>Section content goes here.</p>

              <h3>Subsection Heading</h3>

              <p>Subsection content. Use <strong>bold</strong> for key terms.</p>

              {/* Continue adding h2, h3, p, ul, li tags as needed */}

            </article>

            {/* CTA block — always include at the bottom */}
            <div className="mt-16 rounded-2xl p-8 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
                Short hook line
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                CTA headline.
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-lg mx-auto">
                Supporting sentence that reinforces the CTA.
              </p>
              <Link href="/reserve">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 text-base"
                >
                  Reserve Your Spot
                </Button>
              </Link>
            </div>

            {/* Back to blog */}
            <div className="mt-10">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
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
```

---

## Article Body — Writing Rules

The `<article>` tag uses Tailwind's `prose` typography system. Write content using standard HTML tags:

| What you want | Tag to use |
|--------------|------------|
| Section heading (`##`) | `<h2>` |
| Subsection heading (`###`) | `<h3>` |
| Paragraph | `<p>` |
| Bold text | `<strong>` |
| Bullet list | `<ul>` + `<li>` |
| Numbered list | `<ol>` + `<li>` |
| Link | `<a href="...">` |

**Important**: Apostrophes and quotes in JSX must be escaped:
- `'` → `&apos;`
- `"` → `&quot;`
- Or wrap the text in `{' ... '}` — e.g. `{' it\'s fine '}`

---

## Dev Server

Start with Node in PATH (required on this machine):

```powershell
$env:PATH = 'C:\Program Files\nodejs;' + $env:PATH
cd C:\Users\fitma\flipops-site
npm run dev -- -p 3007
```

View at `http://localhost:3007/blog`

---

## File Structure for a Published Post

```
app/blog/
  page.tsx                              ← Blog index (add card entry here)
  layout.tsx                            ← Blog SEO metadata
  what-is-wholesaling-real-estate/
    page.tsx                            ← Full article page
  your-new-post-slug/
    page.tsx                            ← Your new article page
```

---

## Checklist — Publishing a New Post

- [ ] Write the article content
- [ ] Create `app/blog/[slug]/page.tsx` using the template above
- [ ] Fill in: title, description, date, read time, category badges, body content, CTA
- [ ] Add card entry to `posts` array in `app/blog/page.tsx` with `published: true` and matching `slug`
- [ ] Start dev server and verify at `http://localhost:3007/blog/[slug]`
- [ ] Check headings, paragraph spacing, dark mode, and mobile layout
