import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, "content", "blog");
const files = readdirSync(dir).filter((file) => file.endsWith(".md") && file !== "_index.md");
const slugs = new Map();
const issues = [];

for (const file of files) {
  const content = readFileSync(join(dir, file), "utf8");
  const separators = content.split("\n").filter((line) => line === "---").length;
  if (separators < 2) issues.push(`${file}: missing front matter close`);

  const slug = /^slug: "(.+)"$/m.exec(content)?.[1];
  if (!slug) {
    issues.push(`${file}: missing slug`);
  } else if (slugs.has(slug)) {
    issues.push(`${file}: duplicate slug with ${slugs.get(slug)}`);
  } else {
    slugs.set(slug, file);
  }

  const close = content.indexOf("\n---\n", 4);
  if (close < 0) {
    issues.push(`${file}: missing close marker`);
  } else if (!content.slice(close + 5).trim()) {
    issues.push(`${file}: empty body`);
  }
}

console.log(`checked=${files.length}`);
console.log(`uniqueSlugs=${slugs.size}`);
console.log(`issues=${issues.length}`);
if (issues.length) {
  console.log(issues.slice(0, 20).join("\n"));
  process.exitCode = 1;
}
