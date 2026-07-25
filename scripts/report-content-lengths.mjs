import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, "content", "blog");
const rows = [];

for (const file of readdirSync(dir).filter((name) => name.endsWith(".md") && name !== "_index.md")) {
  const content = readFileSync(join(dir, file), "utf8");
  const close = content.indexOf("\n---\n", 4);
  const body = close >= 0 ? content.slice(close + 5) : content;
  const plain = body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[#>*_`\-[\]()|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean).length;
  const title = /^title: "(.+)"$/m.exec(content)?.[1] ?? "";
  rows.push({ file, chars: plain.length, lines, title });
}

rows.sort((a, b) => a.chars - b.chars);
for (const row of rows.slice(0, 30)) {
  console.log(`${row.chars}\t${row.lines}\t${row.file}\t${row.title}`);
}
