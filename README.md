# iNest Maize Gross Margin Calculator

iNest Agro — *Smarter Farming. Better Decisions.* Responsive web app (React + Vite + TypeScript), Malawi Kwacha (MWK).

## Run locally
    npm install
    npm run dev        # http://localhost:5173
    npm test           # calculation-engine tests (Vitest)
    npm run typecheck

## Build and deploy
    npm run build      # outputs static files to dist/
Host `dist/` on any static host (Netlify, Vercel, GitHub Pages, S3, nginx). No backend, accounts or database.
Data is saved in the browser (localStorage) on the user's own device.

## Structure
`src/calculations` pure engine + tests · `src/data` conversion table and the 11 categories · `src/state` central store ·
`src/pages` five screens · `src/components` shared UI and converters.

## Deliberate deviations from the source workbook
- Every numeric input starts blank (the workbook prefilled 2017/18 values).
- Transport arrangement must be explicitly selected: farm-gate sale excludes transport cost; transport required needs a valid price. Older saved budgets without a selection remain unresolved.
- The alternative scenario appears as soon as the alternative yield and selling price are entered (the main yield is not required). Alternative costs are computed as non-transport costs + alternative yield × transport price per kg, which equals the workbook formula whenever a main yield exists.
- Unlimited user-added items per category (the workbook had a fixed number of spare rows).
