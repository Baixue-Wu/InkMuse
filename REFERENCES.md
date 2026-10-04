# References

InkMuse by Baixue Wu builds on the idea of editable, structured AI design explored by [Moka](https://github.com/vima-tech/moka). Inspected revision: `f522744cc04baeba7c94deb52f9d81d13daab8d5`.

Moka already supports generated design styles, not just fixed templates. Its React/DOM renderer cannot be directly used in a native WeChat Canvas. This initial implementation uses an original portable renderer and provider adapters; no Moka source is copied. Its README declares MIT, but the inspected tree has no standalone license file. Verify the applicable notice before importing code in a future change.

- [MediaWiki imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo): searchable image metadata and attribution.
- [Claude CLI](https://code.claude.com/docs/en/cli-reference): optional local text-only design provider. No coding tools are granted to design requests.
- [WeChat Canvas](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.html): native Canvas integration. Native device verification is tracked separately from browser verification.

Online images retain their creator, source URL, license and any modifications. These are included in exported attribution files. The demo art is procedural artwork drawn by InkMuse, not a retrieved or AI-generated photograph.
