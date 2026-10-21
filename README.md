# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Database access

Household data is accessed through the server's private `DATABASE_URL` connection.
Kakao sessions are authorized in `src/hooks.server.ts`; they do not use Supabase
Auth. All application tables enable RLS without client policies, and the `anon`,
`authenticated`, and `PUBLIC` roles have no table, column, or sequence privileges.
The server connection must own the tables or have `BYPASSRLS`.

Apply SQL migrations with `npm run db:migrate` (with `DATABASE_URL` loaded into the
environment). Use migrations for privilege changes: `db:push` does not apply the
custom grant revocations in migration `0004_secure_public_tables.sql`.

Run `npm run db:check-security` to check the configured database's RLS, client
privileges, future-object grants, and server access. The check loads `.env` if
present and does not change household data. Supabase's informational
“RLS Enabled No Policy” finding is expected for these server-only tables.
