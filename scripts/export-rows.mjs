// Export optimization only. Never replace editable objects with row containers.
// Dota has no per-character offsets: merge only if its measured text reproduces
// every original position. Keep irregular spacing and unknown metadata intact.
const fields = new Set([
  'category_name', 'x_position', 'y_position', 'width', 'height', 'hero_ids'
]);
export function compactCategoryRows(entries, measure) {
  return planCategoryRows(entries, measure).categories;
}
export function planCategoryRows(entries, measure) {
  const unchanged = () => ({ categories: entries.map(({ category }) => category), groups: entries.map((_, i) => [i]) });
  if (!measure) return unchanged();
  const rows = new Map(), replacements = new Map(), removed = new Set();
  const members = new Map();
  const widths = new Map();
  const width = (text) => {
    if (!widths.has(text)) {
      const value = measure(text);
      widths.set(text, value.width ?? value.advances.reduce((sum, advance) => sum + advance, 0));
    }
    return widths.get(text);
  };
  const space = width(' ');
  if (!(space > 0)) return unchanged();
  entries.forEach(({ category: c, layer }, index) => {
    if (c.hero_ids.length || Array.from(c.category_name).length !== 1 ||
        /[\s\u0590-\u08ff]|\p{Mark}/u.test(c.category_name) ||
        Object.keys(c).some((key) => !fields.has(key))) return;
    const key = JSON.stringify([layer, c.y_position]);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ c, index });
  });
  for (const row of rows.values()) {
    row.sort((a, b) => a.c.x_position - b.c.x_position || a.index - b.index);
    let run = null;
    for (const entry of row) {
      if (run) {
        const char = entry.c.category_name;
        // Including the next glyph accounts for kerning at the join.
        const target = entry.c.x_position - run.c.x_position;
        const offset = width(run.text + char) - width(char);
        const count = Math.round((target - offset) / space);
        if (count >= 0 && count <= 1000 && run.text.length + count + char.length <= 5000) {
          const text = run.text + ' '.repeat(count) + char;
          if (Math.abs(width(text) - width(char) - target) <= 0.01) {
            run.text = text;
            replacements.set(run.index, { ...run.c, category_name: text });
            removed.add(entry.index);
            if (!members.has(run.index)) members.set(run.index, [run.index]);
            members.get(run.index).push(entry.index);
            continue;
          }
        }
      }
      run = { ...entry, text: entry.c.category_name };
    }
  }
  const categories = [], groups = [];
  entries.forEach(({ category }, index) => {
    if (removed.has(index)) return;
    categories.push(replacements.get(index) || category);
    groups.push(members.get(index) || [index]);
  });
  return { categories, groups };
}
