# Design decisions

- Target a native WeChat mini program, and provide a browser review client using the same renderer. This preserves the chosen platform while making design and export testable on a development machine.
- Represent work as an editable design document, not a flattened AI image. Text, photography, composition, and provenance remain independently revisable.
- Let the model choose content structure, palette, type size, and image area using a small set of composition primitives. Canvas controls measurement and overflow so generated styling cannot execute code or silently clip text.
- Default to polishing and shortening, retain the original material, and offer verbatim mode. This follows the user's explicit preference while keeping the source available for checking.
- Search images on the server and select candidates by their subject metadata before downloading. The first live test found an unrelated street scene for a coffee query, so taking the first search hit is insufficient.
- Keep image-selection uncertainty visible. Metadata selection is not visual verification; users can inspect and replace candidates. A missing match leaves original abstract artwork and an explicit message.
- Keep provider credentials on the server. The local Claude adapter has no tools, no MCP servers, and no persistent design sessions. Image generation is a separate configurable adapter rather than an implied working service without credentials.
- Build both clients from one portable core and embed its hash in the output manifest. Consumers do not maintain divergent copies of the renderer.
- Attribute the product, commits and GitHub operations to Baixue. External image attribution and required upstream notices remain intact.

- The public portfolio demo is a static sample editor with editing, local uploads, drafts and export. AI generation and remote image operations are disabled explicitly so visitors need no credentials or backend.
