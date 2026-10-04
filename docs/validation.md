# Validation

Initial development: 2026-10-04.

## Automated checks

- Four portable-core tests: no character loss during pagination, idempotent pagination, readable palette contrast, safe draft image URLs, and explicit sample provenance.
- Ten Python tests: model output validation, tool-free design requests, verbatim text preservation, visible subprocess failures, asset signatures, image-generation response contract, selection ID validation, HTTP responses, traversal protection, and rejected cross-origin requests.
- Seven browser/adaptor tests: editing, undo/redo, page order, draft persistence, actual ZIP export with 1500 × 2000 PNG headers and editable JSON, long-copy pagination, failure recovery, isolated image replacement, mobile viewport fit, and the native page's mocked wx storage/Canvas boundary.

The wx boundary test is not a WeChat simulator or device test. It verifies that the native page connects its state and commands to the shared core.

## Live checks

Executed the configured Claude CLI provider and Wikimedia search with a Chinese weekend essay. The service produced five editable pages and three downloaded images with attribution. The first attempt demonstrated an irrelevant first search hit; metadata-based selection was added and a second live request selected coffee images for coffee content and a street image for a walking passage. Candidate selection still requires user judgment because metadata is not image-pixel verification.

Real provider responses were loaded in Chromium, including local cached images, and reviewed at desktop and mobile widths. Live results and user-like draft artifacts stay in the ignored `.local/` directory. The repository screenshot uses the labelled procedural-art sample rather than external photography.

## Remaining platform checks

- Import into WeChat DevTools using the intended AppID and verify Canvas, remote image loading, upload persistence, long-running requests, and album permission flows on iOS and Android.
- Configure and test an actual image-generation service if generated images are required in addition to online search. Current generation validation uses a fixture response only.
- Add public-service authentication, request budgets, deployment supervision, and the required WeChat domain configuration before public hosting. Current verified operation is a local prototype.
- Verify GitHub API authentication as Baixue-Wu before opening or merging a PR. SSH authentication authorizes Git transport, not GitHub API calls.
