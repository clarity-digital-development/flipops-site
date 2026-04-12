# Blog Section Editing Guide

This guide covers everything you need to safely edit the FlipOps blog section without affecting other parts of the site.

## Scope — What You Can Safely Edit

You should ONLY edit files inside these two paths:

```
flipops-site/app/blog/page.tsx      ← All blog content and layout lives here
flipops-site/app/blog/layout.tsx    ← Blog metadata (title, description, OG tags)
```

**Do NOT edit** any files outside `app/blog/`. The rest of the codebase (header, footer, shared components, styles) is managed separately.

---

## File: `app/blog/page.tsx`

This is a single self-contained React component (`'use client'`). Everything — data, layout, cards, styles — is in this one file.

### Blog Post Data

Posts are defined as TypeScript constants at the top of the file.

**Featured post** (the large card at the top):

```typescript
const featuredPost: BlogPost = {
  title: 'How AI Distress Scoring Is Changing Real Estate Investing',
  teaser: 'Traditional lead lists are static. AI-powered scoring is dynamic...',
  category: 'Technology',
  date: 'March 2026',
};
```

**Regular posts** (the 2-column grid below):

```typescript
const posts: BlogPost[] = [
  {
    title: 'The True Cost of Tool Sprawl for Real Estate Investors',
    teaser: 'Six subscriptions. Six logins. Zero integration...',
    category: 'Strategy',
    date: 'March 2026',
  },
  // ... more posts
];
```

### How to Add a New Blog Post

Add an object to the `posts` array:

```typescript
{
  title: 'Your New Post Title',
  teaser: 'A 1-2 sentence summary that appears on the card.',
  category: 'Strategy',   // Must match a key in categoryColors (see below)
  date: 'April 2026',
},
```

### How to Edit an Existing Post

Find the post object by its title in either `featuredPost` or the `posts` array, then change the `title`, `teaser`, `category`, or `date` fields.

### Available Categories

Categories have predefined colors. Use one of these exact strings:

| Category     | Light Mode        | Dark Mode        |
|-------------|-------------------|------------------|
| `Technology` | Blue              | Blue             |
| `Strategy`   | Purple            | Purple           |
| `Guides`     | Emerald/Green     | Emerald/Green    |
| `Data`       | Amber/Yellow      | Amber/Yellow     |
| `Product`    | Teal              | Teal             |

To add a new category, add an entry to the `categoryColors` object:

```typescript
const categoryColors: Record<string, { bg: string; text: string }> = {
  // ... existing categories ...
  'Market Analysis': {
    bg: 'bg-rose-100 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-400',
  },
};
```

### How to Change the Featured Post

Swap the content of `featuredPost` with whichever post you want highlighted. The featured post renders as a large full-width card with an interactive distress scoring visualization on the left.

### How to Edit Section Text

- **Page heading**: Search for `The FlipOps Blog` (inside the `<h1>` tag)
- **Page subtitle**: Search for `Strategies, guides, and insights` (inside the `<p>` below)
- **Newsletter heading**: Search for `Get investor insights delivered weekly`
- **Newsletter subtitle**: Search for `Join our newsletter for strategies`
- **CTA heading**: Search for `Explore the Platform`
- **CTA subtitle**: Search for `See how FlipOps replaces`

---

## File: `app/blog/layout.tsx`

Contains SEO metadata only. Edit if you want to change the page's `<title>` or meta description:

```typescript
export const metadata: Metadata = {
  title: 'Blog | FlipOps',
  description: 'Insights, guides, and strategies for real estate investors...',
};
```

---

## Important Rules

1. **Only edit files in `app/blog/`** — never touch `app/components/`, `app/globals.css`, `components/ui/`, or any other directory.
2. **Don't change imports** — the file imports `Header`, `Footer`, `SectionPill`, `Button`, and icons from lucide-react. Leave these as-is.
3. **Don't modify the `cardStyle` object** — this controls the card appearance (shadows, gradients) for both light and dark mode. It's already set up correctly.
4. **Don't remove `'use client'`** — the file uses React hooks (`useState`, `useEffect`) and must remain a client component.
5. **Tailwind CSS** — all styling uses Tailwind utility classes. If you need to change spacing/sizing, modify the class strings. Don't add inline CSS unless matching the existing pattern.
6. **Dark mode** — the site supports dark mode. Any color classes should include both light and dark variants (e.g., `text-gray-900 dark:text-white`).

## Dev Server

```bash
cd flipops-site
npm run dev
```

The site runs on `http://localhost:3000` (or port 3007 if configured). Navigate to `/blog` to see your changes.

## Quick Reference — Common Edits

| Task | What to change |
|------|---------------|
| Add a blog post | Add object to `posts` array |
| Edit a post title/teaser | Find the post object, change the string |
| Change featured post | Edit `featuredPost` object |
| Add a category | Add entry to `categoryColors` |
| Change page title/SEO | Edit `layout.tsx` metadata |
| Change section headings | Find the text string in the JSX |
| Reorder posts | Reorder objects in the `posts` array |
| Remove a post | Delete the object from the `posts` array |
