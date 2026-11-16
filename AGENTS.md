# Pipforge

- This repository is the main platform where clients configure and pay for branded Deriv sites.
- GitHub remote: `https://github.com/kingz254/pip`; current shared branch: `main`.
- Keep completed, authorized changes synchronized with this repository. Preserve unrelated local work; verify before committing and pushing. Saving files alone does not update GitHub.
- Preview: run `npm run dev` here and open `http://localhost:5173` in the Codex browser. Keep the preview available when requested; refresh it after edits.
- Run `npm test` before syncing. Run `npm run check:functions` when changing Edge Functions and Deno is available; disclose checks that cannot run.
- `public/` contains the static builder and tenant renderer; `supabase/` contains backend functions and migrations; `tests/` contains local checks.
- Empty Supabase settings in `public/config.js` mean demo mode. Do not claim that payments, Google login, or deployments work without live verification.
- Never commit secrets or generated `graphify-out/` data.
- The four sibling Deriv apps are not yet integrated; do not move or wire them into fulfilment until that work is requested.
