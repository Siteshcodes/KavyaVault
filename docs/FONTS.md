# Bundled font notices

All font binaries in `public/fonts` are distributed under the SIL Open Font License 1.1. The corresponding `OFL*.txt` files are retained and shipped with the app. PDF embeds unmodified fonts; EPUB also includes the Noto license text. No font is downloaded during writing, reading, or export.

| Fonts | Upstream source | License file |
|---|---|---|
| Noto Serif Devanagari, Noto Serif, Noto Sans Symbols 2 | [notofonts/noto-fonts](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf) | `OFL.txt` |
| Noto Emoji (monochrome) | [googlefonts/noto-emoji, pinned revision](https://github.com/googlefonts/noto-emoji/blob/9a5261d871451f9b5183c93483cbd68ed916b1e9/fonts/NotoEmoji-Regular.ttf) | `OFL-Emoji.txt` |
| Martel, Mukta, Rozha One, Yatra One, Tiro Devanagari Hindi | [google/fonts](https://github.com/google/fonts/tree/main/ofl) | `OFL-<family>.txt` |

`npm run fonts:bundle` deterministically regenerates `src/services/books/export/bundledFonts.js` from the checked-in Noto binaries. Each embedded source includes its SHA-256. It performs no downloads. The UI loads the other local families through `src/styles/fonts.css`.

Exports use Noto Serif Devanagari with Latin, symbol, and monochrome emoji fallbacks. Preview font selection applies to the HTML preview; exported typography uses the embedded Noto families. Unsupported characters produce a clear PDF export error instead of silent missing-glyph boxes.

Font shaping uses [Fontkit](https://github.com/foliojs/fontkit), with OpenType substitution and positioning. Preserve its dependency license when redistributing source or dependency bundles.

`public/THIRD-PARTY-NOTICES.txt` preserves the locked runtime dependencies' supplied license material and the Brotli decoder's Apache notice. Regenerate it with `node scripts/bundle-notices.mjs` after changing dependencies.
