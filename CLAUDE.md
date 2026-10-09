# InkMuse

By Baixue Wu. A content-aware visual publishing studio targeting a native WeChat mini program, with a browser companion for development and review.

## Working here

- All project Git authors and committers are Baixue Wu <baixuewu0@gmail.com>. Use the github-baixue SSH identity for Baixue-Wu. GitHub API operations must also authenticate as Baixue-Wu. Never substitute another account. Do not add assistant attribution trailers.
- Work on a feature branch, push commits, open a PR, then merge. Do not rewrite published history.
- Chinese planning is maintained in the separate local planning repository; do not import its history or local machine paths here.
- `core/` owns the portable design document and Canvas renderer. It has no network or platform dependencies.
- `server/` owns model and image provider knowledge. Configuration is passed explicitly via a JSON file and CLI arguments, never client-side secrets or environment conventions.
- `web/` is the review client. `miniprogram/` is the native WeChat client. Both use core through build artifacts, with a build manifest recording their source hash.
- `scripts/build.cjs --help` builds the two clients. `python3 -m server --help` runs the backend. Run `npm test`, `npm run build`, and meaningful browser checks before delivery.
- Default text mode allows polishing and shortening. Preserve the source and offer a verbatim mode. Never invent facts to fill a design.
- Failed model, search, image, or export requests must be visible and recoverable. Never silently replace a failed AI request with a demo.
- Keep source attribution on external images. Keep upstream license notices if upstream code is ever copied.
- Comments and docstrings do not use em dashes. Library functions raise exceptions; only CLI entry points exit.

## Reference

Moka is an interaction reference, not vendored code. See REFERENCES.md for the inspected revision and limits. The product remains general-purpose; do not restrict it to film.
