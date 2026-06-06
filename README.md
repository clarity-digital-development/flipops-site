# FlipOps

Real estate investment automation platform for fix-and-flip and wholesaling operations.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment (copy and fill in values)
cp env.sample .env.local

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run migrate

# Start dev server
npm run dev
```

## Production URL

- **App**: https://flipops-api-production.up.railway.app

## Project Structure

```
flipops-site/
├── app/                    # Next.js app router pages & API routes
├── components/             # React components
├── lib/                    # Core business logic & utilities
│   └── cron/               # TypeScript cron automation (guardrails, monitoring, discovery)
├── prisma/                 # Database schema & migrations
├── scripts/                # Utility scripts
└── docs/                   # Documentation
    ├── guardrails/         # G1-G4 implementation docs
    ├── integrations/       # Google Sheets
    ├── deployment/         # Deployment & onboarding guides
    └── development/        # Testing, decisions, dev guides
```

## Key Scripts

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run test             # Run tests
npm run prisma:studio    # Database GUI
npm run typecheck        # TypeScript check
```

## Documentation

| Topic | Location |
|-------|----------|
| **Guardrails (G1-G4)** | [docs/guardrails/](docs/guardrails/) |
| **Integrations** | [docs/integrations/](docs/integrations/) |
| **Deployment** | [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md) |
| **Architecture Decisions** | [docs/development/DECISIONS.md](docs/development/DECISIONS.md) |
| **Testing** | [docs/development/TESTS.md](docs/development/TESTS.md) |
| **Platform Overview** | [docs/FLIPOPS_PLATFORM_OVERVIEW.md](docs/FLIPOPS_PLATFORM_OVERVIEW.md) |

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, Radix UI
- **Backend**: Next.js API routes, Prisma ORM, PostgreSQL
- **Auth**: Clerk
- **Automation**: TypeScript cron jobs
- **Hosting**: Railway

## Environment Variables

Required variables (see `env.sample` for full list):

```
DATABASE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
FO_API_KEY=
```

## License

Proprietary - All rights reserved.
