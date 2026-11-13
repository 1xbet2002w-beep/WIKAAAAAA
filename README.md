# RASD AI

Arabic football analysis dashboard with an Express API and a React/Vite interface.

## Development

Use Node.js 24, run `npm ci`, then `netlify dev --port 8889`.
Netlify supplies the database connection and AI Gateway configuration.

## Hosting

Netlify publishes `dist` and runs `netlify/server/index.mjs` for `/api/*`.
The build command is `npm run build`. Application settings, the prediction ledger,
analysis sessions and demo state persist in Netlify Database. Database migrations
in `netlify/database/migrations` are applied during deployment.

Run `npm run lint` for TypeScript validation. `/api/health` checks the API process;
`/api/qa/run` runs the application's verification suite.
