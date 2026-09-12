# Skillet repository guidance

Skillet is a Bun workspace containing the local Hono API and React interface.

## Workspace layout

- Keep deployable applications under `apps/*`.
- Keep shared root configuration and quality tooling at the workspace root.
- Keep `apps/web/src/app/App.tsx` as the composition and routing root.
- Put reusable interface code in `apps/web/src/components` and route-level views in `apps/web/src/pages`.
- Keep the bundled Strawn font and its license under `apps/web/src/assets/fonts`.
- Use readable system sans-serif typography throughout the application. Reserve Strawn for website branding and display headings; never use it as the default application or body font.

## Verification

Run focused checks while iterating. Run `bun run quality` and `bun run test:browser` before handing off broad frontend or workspace changes.

Skillet reads and writes local agent configuration. Browser tests must only exercise read-only flows unless a test uses an isolated fixture directory.
