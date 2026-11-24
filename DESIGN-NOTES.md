# Design notes

What changed in the look of this sample after the first build, where it is, and why. The direction it stays inside
was set before any screen was built: a dense, plain operational tool for a food plant. IBM Plex Sans and Mono, ink on
light grey with white panels, blue for actions, green, amber and red for the state of a lot, violet only for
localization tooling, and no imagery.

Three changes. The palette, the type and the density already fitted that direction, so a fourth was not needed.

## 1. A mark for Tallyfield

**What.** A tally of five: four uprights and one stroke across them. White on the blue tile in the browser tab and on a
phone's home screen; in the header, beside the name, in ink with the fifth stroke in the action blue.

**Where.** `public/favicon.svg`, `public/favicon.ico` (16, 32 and 48 pixels), `public/apple-touch-icon.png`, the three
link tags in `index.html`, and `src/assets/brand/mark.svg`, which `src/components/Shell.tsx` shows in the header.

**Why.** The tab icon was a letter T in a square, the icon every unfinished project has, and it sits in the tab for
the whole visit. A tally is what the app does, counting what comes off a line, and it is what the name says, so the
made-up product gets an identity without a picture, a flag or a leaf. Two addresses that browsers and phones ask for by
name, `/favicon.ico` and `/apple-touch-icon.png`, used to be answered with the HTML page; they are real files now.

**Details.** The uprights sit on whole pixels at 16 and 32, so the four strokes stay four in a tab. The fifth stroke
has a thin clear edge where it crosses the others. The header mark is decoration next to the name (empty alt text) and
is hidden below 640 pixels wide, where the header has no room for it.

## 2. One figure: where a message from the backend goes

**What.** Three paths from the API's answer to what the user sees. Solid blue is the normal case: a code the client has
text for. Dashed violet marks the two fallbacks: a code with no client text or a missing value, and an answer with no
code at all.

**Where.** The Handoff page, under "Messages from the backend", after the first paragraph
(`src/components/sample/BackendMessagePaths.tsx`, with the two drawings in `src/assets/diagrams/`). The README shows
the same figure as `docs/backend-messages.png`.

**Why.** Messages that come from the .NET backend are the one dependency the client asked about by name, and the page
answered in four paragraphs. The figure shows which case is the goal, what the user reads in the other two, and what
the API's owners would be asked for, before anyone reads the paragraphs.

**Details.** On the page the drawing is inline SVG, so its words are text in the page's own fonts and stay sharp at
any zoom. There are two layouts: four columns where the panel can show them at full size (1280 pixels and wider), and
top to bottom below that. A screen reader gets one image with a title and a full description. The codes and the
Portuguese message are read from `contracts/api-error-codes.json` and `src/i18n/locales/pt-BR/errors.json` when the
figure is built, and the build stops if the code used for the second path is ever given a translation.

## 3. Start page: a checklist and a plain panel instead of two grids of cards

**What.** "Eight things to try" is one white panel with eight numbered rows: what to do, what to look for, and a link
named for the screen it opens. "What is real here, and what is a stand-in" is one panel with three paragraphs, the same
shape as the first section of the Handoff page.

**Where.** `src/screens/sample/Home.tsx`.

**Why.** This is the page the link opens on. It was the only screen that looked like a product page: eight identical
cards, each with a number in a circle and the same "Open it" link, then three more cards. The reader works through the
steps like a test script, so they are now a list, as dense as the plant screens beside it.

## Wording fixed in the same pass

- The eight links say where they go ("Production orders", "Lot CF-26-0426", "Record output", "Receiving",
  "Translation status", "Handoff") instead of "Open it" eight times. Step 8 now links to both pages it names.
- Step 6 names the language to choose. In English nothing is underlined, so the step showed nothing.
- The header's count says "strings", the word the status page and the check use, not "texts".
- The one straight apostrophe in the English files is now the typographic one.

## Left alone, on purpose

- The icons in the left menu. They help find a screen, headings carry none, and the status chips need theirs.
- The four tiles at the top of Translation status. Their numbers are real and it is the page's summary.
- The link preview image, `public/og.png`. It already shows what the sample is about.

## Rebuilding the graphics

```bash
design/build.sh
```

It needs Python 3, with nothing beyond the standard library, and Inkscape 1.4 (`inkscape` on the PATH, or set
`INKSCAPE`). Nothing is downloaded. The steps, in order:

1. `design/make_assets.py svg` writes the SVG sources. The header mark and the two inline drawings are used exactly as
   written. To break the diagram's lines in the right places it measures the text with the IBM Plex files the app
   already ships (`node_modules/@fontsource`).
2. Inkscape turns the tab icon's strokes into filled shapes (`object-stroke-to-path`), and
   `design/make_assets.py tidy` strips Inkscape's export down to shapes and fills: `public/favicon.svg`.
3. Inkscape draws that icon at 16, 32 and 48 pixels and `design/make_assets.py ico` packs them into
   `public/favicon.ico`. The phone icon is drawn at 180 pixels: `public/apple-touch-icon.png`.
4. `design/make_assets.py fonts` unpacks the same IBM Plex files to TTF, and Inkscape draws the README's figure with
   them at twice its size: `docs/backend-messages.png`.

Everything `design/build.sh` writes on the way goes to `design/build/`, which git ignores. To change a colour, a
stroke or a sentence in the figure, change it in `design/make_assets.py` and run the script again.
