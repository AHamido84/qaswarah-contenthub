/**
 * Prints what the app sees in the spreadsheet: tabs, header row, column mapping, duplicate
 * columns, merges, dropdown option lists and issues. Read-only – it never writes.
 *
 *   npm run inspect:sheet            # uses .env.local (DATA_SOURCE=google for the real sheet)
 *   npm run inspect:sheet -- --json  # machine-readable
 */
import { loadWorkbook, planDuplicateFix, getGateway } from "../src/lib/hub";
import { colLetter, analyzeLayout } from "../src/lib/sheets/parse";
import { FIELD_BY_KEY, SELECT_FIELDS } from "../src/lib/sheets/schema";

const wb = await loadWorkbook({ fresh: true });

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(wb, null, 2));
  process.exit(0);
}

console.log(`\n${wb.title}  (${wb.source}, ${wb.spreadsheetId})\n`);
for (const c of wb.companies) {
  const l = c.layout;
  console.log(`■ ${c.name}  gid=${c.id}`);
  console.log(`  header row: ${l.headerRow + 1}   ideas: ${c.ideas.length}   placeholder rows ignored: ${c.placeholderRows}`);
  console.log(
    "  columns:  " +
      Object.entries(l.columns)
        .map(([k, col]) => `${colLetter(col!)}=${FIELD_BY_KEY[k as keyof typeof FIELD_BY_KEY].header}`)
        .join("  "),
  );
  for (const key of SELECT_FIELDS) {
    const o = c.options[key];
    console.log(
      `  ${FIELD_BY_KEY[key].header}: [${o.values.join(" | ")}]  (${o.source}${o.strict ? ", strict" : ""})` +
        (o.offList.length ? `  off-list in rows: ${o.offList.join(", ")}` : ""),
    );
  }
  if (l.duplicates.length) {
    const sheet = await getGateway().fetchSheet(c.id);
    const plan = planDuplicateFix(sheet, analyzeLayout(sheet)!);
    console.log(`  DUPLICATE COLUMNS: ${plan.columns.map((d) => `${d.duplicate}(${d.header}, primary ${d.primary})`).join(", ")}`);
    console.log(`    proposed fix: move ${plan.moves.length}, keep ${plan.conflicts.length} conflicts in notes, ${plan.identical} identical, ${plan.orphans.length} orphan values (backup only)`);
  }
  for (const i of c.issues) console.log(`  [${i.severity}] ${i.title}\n      ${i.detail.replace(/\n/g, "\n      ")}`);
  console.log();
}
for (const t of wb.ignoredTabs) console.log(`(ignored) ${t.name}: ${t.reason}`);
