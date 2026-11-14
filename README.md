# BillClarity

**MI4, INC. · kdmirah lab** · Telecom Bill Detective

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.2-black?logo=nextdotjs)](telecom-tool-development-challenge/package.json)
[![React 19](https://img.shields.io/badge/React-19.2.6-149eca?logo=react&logoColor=white)](telecom-tool-development-challenge/package.json)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.9.3-3178c6?logo=typescript&logoColor=white)](telecom-tool-development-challenge/package.json)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169e1?logo=postgresql&logoColor=white)](telecom-tool-development-challenge/src/db/schema.ts)
[![Deployment](https://img.shields.io/badge/Deployment-Vercel-black?logo=vercel)](https://billclarity-eosin.vercel.app)
[![MIT License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

BillClarity helps Malaysian telecom customers review charges and prepare questions for provider support.

**[Production deployment](https://billclarity-eosin.vercel.app)** · **[Report an error](https://github.com/strdst7/BillClarity/issues)**

> **Public demo:** Anyone can open the deployment. Audits share one database without user accounts or per-user access controls. Do not enter private bills or personal data.

## What it does

| Area | Behavior |
| --- | --- |
| Bill entry | Paste bill text or enter charges manually. |
| Charge review | Classify lines, explain charges, flag review items, and compare prior amounts. |
| Proration | Estimate a mid-cycle plan change from monthly rates and day counts. |
| Support brief | Build questions and an opening script. Copy, print, or download TXT and Markdown. |
| Outcome tracker | Save support notes, case references, promised credits, and checklist progress. |
| Sample data | Explore three synthetic scenarios with fictional providers. |
| Preferences | Switch between English and Bahasa Melayu. Choose light, dark, or system theme. |

Amounts use Malaysian Ringgit (`MYR`) and integer sen in storage. The app does not convert currencies.

## Start locally

Requirements: Node.js 24, npm, and a PostgreSQL database reachable through `DATABASE_URL`.

```bash
git clone https://github.com/strdst7/BillClarity.git
cd BillClarity/telecom-tool-development-challenge
npm ci
cp .env.example .env.local
```

Modify `.env.local` with your database connection string. Keep credentials out of commits.

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

Create the database tables, then start the development server:

```bash
npm run db:push
npm run dev
```

Open `http://localhost:3000`. The first app request inserts the synthetic sample audits.

> `db:push` applies schema changes to the configured database. Use an isolated database for development.

## Commands

Run commands from `telecom-tool-development-challenge/`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm start` | Serve a production build. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Check TypeScript types. |
| `npm run db:push` | Apply the Drizzle schema to `DATABASE_URL`. |

For a local production run:

```bash
npm run build
npm start
```

## Use the app

1. Open a synthetic sample or create an audit from pasted text or manual charges.
2. Review charge explanations, flags, prior amounts, and questions.
3. Compare a mid-cycle charge in **Proration Check** when applicable.
4. Select questions in **Support Prep Brief** and save the support outcome.

The parser accepts bill text with charge descriptions and ringgit amounts. It cannot fetch bills from telecom accounts.

## Project layout

The Next.js app lives in `telecom-tool-development-challenge/`, not the repository root.

| Path | Responsibility |
| --- | --- |
| `src/app/` | Page, layout, styles, and API routes. |
| `src/components/` | Audit workspace, entry form, proration calculator, and support brief. |
| `src/lib/bill-analyzer.ts` | Bill parsing, classification, estimates, and brief generation. |
| `src/lib/audit-service.ts` | Audit persistence and synthetic sample sync. |
| `src/lib/sample-bills.ts` | Synthetic sample scenarios. |
| `src/db/schema.ts` | Drizzle tables for audits and bill line items. |
| `drizzle.config.ts` | Database schema tool config. |

The server stores audits and line items in PostgreSQL. The browser stores language and theme preferences in `localStorage`.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check database connectivity. |
| `POST` | `/api/parse` | Preview parsed lines without saving an audit. |
| `GET`, `POST` | `/api/audits` | List audits, create an audit, or reset a sample. |
| `GET`, `PATCH`, `DELETE` | `/api/audits/[id]` | Read, modify, or remove an audit. |
| `POST` | `/api/audits/[id]/items` | Add a line item. |
| `PATCH`, `DELETE` | `/api/audits/[id]/items/[itemId]` | Modify or remove a line item. |

The API accepts JSON payloads and uses Zod for request checks. Consult each `route.ts` file for exact payload fields.

## Deploy on Vercel

| Project setting | Value |
| --- | --- |
| Framework | Next.js |
| Root Directory | `telecom-tool-development-challenge` |
| Node.js | `24.x` |
| Environment variable | `DATABASE_URL` for a PostgreSQL database |

Connect a dedicated PostgreSQL database and set `DATABASE_URL` in the Vercel project. Apply the schema before opening the app.

```bash
cd telecom-tool-development-challenge
npm run db:push
```

This command reads `DATABASE_URL` from the local environment or `.env.local`. Do not run it against an unrelated database.

GitHub pushes trigger deployments when the repository connects to the Vercel project. The production project currently uses a dedicated Neon database.

## Data and limitations

- **No user accounts:** The public API has no app-level authentication or per-user data isolation. Visitors can read and modify shared audits.
- **Sensitive data:** Do not paste account numbers, identity numbers, or payment details. Saved audits persist in the configured database.
- **Synthetic samples:** Sample providers and amounts are fictional. The app inserts missing samples on the first request.
- **Estimates:** Classification and proration are rule-based guidance. Provider terms determine actual charges, credits, and taxes.
- **Currency:** The app labels amounts as `MYR`. It does not convert amounts entered in another currency.

## License

This project uses the [MIT License](LICENSE). See `LICENSE` for the full terms.
