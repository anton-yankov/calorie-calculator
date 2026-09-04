<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working agreements

- When I ask for a plan or to "plan out" something, that means planning only — do NOT make any code changes yet. Deliver the plan (as a document in `.plans/` only if I explicitly ask for one there, otherwise just present it) and wait for me to ask before implementing.
- HTML plans, prototypes, and visual write-ups belong only in `.plans/` — never at the project root or other scattered locations.
- Plan documents in `.plans/` must follow the design system in [.plans/style-guide.html](.plans/style-guide.html) (palette, typography, numbered sections, diagram rules).
- Only commit or push when I explicitly ask for it — never as an automatic follow-up to other work.
- Give me any required SQL inline; this project has no migrations.

## Publishing HTML plans

Publish every HTML plan, prototype, or visual write-up to postplan with `npx postplan upload .plans/plan.html --description "short label"` and share the printed draft URL. Keep the source file in `.plans/` (not the project root). My key in `~/.postplan` attributes uploads automatically — never run `postplan auth` commands. Give the HTML a meaningful `<title>` (it becomes the draft's display name in my dashboard).

The file must be a single, fully self-contained page. Postplan rejects `<link>` tags and external/module scripts — so when following [.plans/style-guide.html](.plans/style-guide.html), drop its Google Fonts and Prism CDN tags for the uploaded copy: keep the fallback font stacks (Georgia serif / system-ui / monospace) and style `<pre>` blocks with plain `--code-bg` instead of Prism. Inline classic `<script>` is fine; inline event handlers, JavaScript URLs, forms, iframes, and meta-refresh are also rejected. Re-uploading the same file adds a new version of the same draft.
