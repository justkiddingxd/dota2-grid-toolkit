# Continuous zoom and category optimization

## Zoom

`ZoomFields.jsx` adds a continuous logarithmic slider and an editable percentage (including decimal percentages). `scripts/zoom.mjs` defines a 1–800% range. The plus/minus buttons remain shortcuts, not the only available values. Ctrl+wheel uses the actual wheel delta, normalized for pixel/line/page events, instead of one fixed jump per event.

`setZoom` anchors the content under the pointer for wheel zoom and under the viewport centre for slider/typed changes. Canvas scrolling stays inside the studio, with Space-drag still available. Fit restores the automatic viewport scale. Zoom is a view setting and does not alter hero dimensions, symbol coordinates or exports. The existing 16-million-pixel canvas raster limit still applies at large scales.

## Optimizer

The counter action is now “Оптимизация”; the >2000-category warning also offers the action. Default mode only reports exact row compaction and permits downloading without changing the editor. Detail reduction is an explicit checkbox, followed by an editable category budget and before/after previews.

`core.categoryEntries` is shared by export and analysis. `export-rows.planCategoryRows` returns both exported categories and their contributing entry indexes. This lets the optimizer treat a losslessly compacted row as one unit instead of deleting arbitrary glyphs from it and accidentally losing its compression.

`category-optimization.mjs`:

1. Determines eligible single-symbol objects from visible, unlocked layers. Hero groups, text runs, hidden/locked layers and mixed protected rows are excluded.
2. Measures neighbourhood density and covariance using spatial-bucket moments. Thin directional regions and isolated details receive higher weight than dense fills. Large compactable runs receive an additional retention weight.
3. Preserves a representative for each eligible layer and extreme positions where the budget allows.
4. Allocates the remaining budget through a weighted spatial tree, keeping both subregions represented where possible. All choices are deterministic.
5. Removes entire selected units and recomputes the actual exported category count. Retained entities keep their IDs, glyphs, positions, dimensions and metadata exactly.

The minimum budget includes protected categories and one representative per eligible layer. Actual JSON counts are shown separately from the raw editor count. This is a geometry-based heuristic, not semantic image recognition: small details can still be lost. The preview makes that tradeoff reviewable. It cannot guarantee a particular Dota FPS or that a complex protected document can fit below 2000 categories.

“Применить к холсту” is one undoable transaction. “Скачать JSON” exports the chosen result without applying detail removal to the editor. Other grid drafts and the imported collection remain in the file. Row compaction still happens only during export.

## Validation

- 111 tests passed, including arbitrary/decimal zoom values, normalized wheel deltas, row-aware category budgets, contour retention versus a dense fill, protected data, exact retained geometry, deterministic results and a 10000-symbol case with coincident points.
- Syntax checks and production build passed.
- Public-browser verification: 137.5% and 800%, slider fine increments, fit reset, internal scrolling, 54 → 30 category reduction, and undo restoring 54 then the original 6 categories. Browser console had no warnings/errors.
- Layout inspected at 1280×800, 652×695 and 390×844. No page-width overflow at the tested scales. The narrow counter is inset to avoid the floating dock.
- In-game appearance and performance were not tested.
