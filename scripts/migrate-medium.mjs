import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const postsDir = join(root, "backup", "posts");
const outDir = join(root, "content", "blog");
const excludedTitles = new Set([
  "About Us",
  "[독서] AI 딥 다이브",
]);

const entityMap = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(value = "") {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    }
    return entityMap[entity] ?? _;
  });
}

function stripTags(value = "") {
  return decodeEntities(value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extract(html, pattern) {
  return pattern.exec(html)?.[1] ?? "";
}

function extractAttr(tag = "", attr) {
  return new RegExp(`${attr}=["']([^"']+)["']`, "i").exec(tag)?.[1] ?? "";
}

function extractBody(html) {
  const marker = /<section\s+data-field=["']body["'][^>]*>/i;
  const match = marker.exec(html);
  if (!match) return "";
  const start = match.index + match[0].length;
  const footer = html.indexOf("<footer", start);
  const end = footer === -1 ? html.length : footer;
  let body = html.slice(start, end).trim();
  body = body.replace(/<\/section>\s*$/i, "").trim();
  body = body
    .replace(/<div[^>]*class=["'][^"']*\bsection-divider\b[^"']*["'][^>]*>\s*<hr[^>]*>\s*<\/div>/gi, "")
    .replace(/<hr[^>]*class=["'][^"']*\bsection-divider\b[^"']*["'][^>]*>/gi, "")
    .replace(/<iframe\b[^>]*src=["']([^"']+)["'][\s\S]*?<\/iframe>/gi, (_, src) => {
      return `<p><a href="${src}">Embedded media</a></p>`;
    });
  return body;
}

function slugFrom(fileName, canonical) {
  const id = (fileName.match(/([0-9a-f]{12})\.html$/i)?.[1] ?? fileName.replace(/\.html$/i, "")).toLowerCase();
  if (canonical) {
    try {
      const path = decodeURIComponent(new URL(canonical).pathname.split("/").filter(Boolean).pop() ?? "");
      const cleaned = path
        .replace(new RegExp(`-${id}$`, "i"), "")
        .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      if (cleaned) return `${cleaned}-${id}`;
    } catch {
      // Fall back to the Medium id below.
    }
  }
  return id;
}

function frontMatterValue(value) {
  return JSON.stringify(value ?? "");
}

function dateFromFileName(fileName) {
  const match = /^(\d{4}-\d{2}-\d{2})_/.exec(fileName);
  return match ? `${match[1]}T00:00:00Z` : "2026-07-25T00:00:00Z";
}

function normalizeMarkdown(md) {
  const cleaned = cleanEmphasisArtifacts(md);
  const headings = normalizeHeadingLevels(stripHeadingFormatting(cleaned));
  const tocKeys = collectTocKeys(headings);
  const promoted = promoteStandaloneBoldHeadings(headings, tocKeys);
  const normalized = normalizeHeadingHierarchy(promoted, tocKeys);
  const withoutArtifacts = removePromptArtifacts(normalized);
  const withCodeBlocks = fenceCodeBlocks(embedMedia(withoutArtifacts));

  return latexizeMath(htmlizeBold(withCodeBlocks))
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .trim();
}

function removePromptArtifacts(md) {
  const startMatch = /You're very talented fund manager,/.exec(md);
  if (!startMatch) return md;

  const promptStart = startMatch.index;
  const previousBreak = md.lastIndexOf("\n\n", promptStart - 1);
  const previousParagraphStart = previousBreak === -1 ? 0 : md.lastIndexOf("\n\n", previousBreak - 1) + 2;
  const previousParagraph = md.slice(previousParagraphStart, previousBreak === -1 ? promptStart : previousBreak);
  const removeStart = /AutoGen|Prefix Caching|system prompt|시스템 프롬프트/i.test(previousParagraph)
    ? previousParagraphStart
    : promptStart;
  const rest = md.slice(promptStart);
  const endMatch = /\.\.\. \(this process can repeat multiple times, once for each required tool\)\s*/.exec(rest);
  if (!endMatch) return md;

  const removeEnd = promptStart + endMatch.index + endMatch[0].length;
  return `${md.slice(0, removeStart).trimEnd()}\n\n${md.slice(removeEnd).trimStart()}`;
}

function cleanCodeLine(line) {
  return line
    .replace(/\s*\\\s*$/g, "")
    .replace(/\\([<>_|])/g, "$1")
    .replace(/=\>/g, "=>")
    .replace(/-\>/g, "->");
}

function codeCandidateScore(line) {
  const trimmed = cleanCodeLine(line).trim();
  if (!trimmed) return 0;
  if (/^(---|\+\+\+|#{1,6}\s|[-*+]\s|\d+\.\s|>\s|!\[|\[|<div|<\/div|<strong>|<\/strong>|\|)/.test(trimmed)) return 0;
  if (/^(import|using|package|namespace)\b/.test(trimmed)) return 3;
  if (/^(public|private|protected|internal)\b/.test(trimmed)) return 3;
  if (/^(class|interface|struct|enum)\b/.test(trimmed)) return 3;
  if (/^(fn|let|var|const|await|async|return|if|else|for|foreach|while|switch|case)\b/.test(trimmed)) return 3;
  if (/^(SELECT|UPDATE|INSERT|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN)\b/i.test(trimmed)) return 3;
  if (/^(error|warning)\[[A-Z0-9]+\]:/.test(trimmed)) return 3;
  if (/^(\/\/|#)\s/.test(trimmed)) return 2;
  if (/^\s*(\^+|-+|\|)$/.test(trimmed)) return 2;
  if (/^[{}()[\];,]+(?:\s*\/\/.*)?$/.test(trimmed)) return 2;
  if (/^\.[A-Za-z_][\w.]*\(/.test(trimmed)) return 3;
  if (/(::|=>|->|println!|System\.out|console\.|String::|Dictionary<|HashSet<|IGrain|Task<|new\s+\w+|UUID\.|plt\.|np\.|Array\.from|lambda\s|def\s+\w+\(|#include\b)/.test(trimmed)) return 3;
  if (/^[A-Za-z_][\w.<>\[\],\s]*\s+\w+\s*=\s*[^.].*[;)]?$/.test(trimmed)) return 2;
  if (/^[A-Za-z_][\w.]*\([^)]*\)\s*[;{]?$/.test(trimmed)) return 2;
  return 0;
}

function isCodeFenceCandidate(lines, index) {
  const score = codeCandidateScore(lines[index]);
  if (score >= 3) return true;
  if (score === 0) return false;
  return codeCandidateScore(lines[index - 1] ?? "") > 0 || codeCandidateScore(lines[index + 1] ?? "") > 0;
}

function inferCodeLanguage(lines) {
  const code = lines.join("\n");
  if (/import java|System\.out|public static void main/.test(code)) return "java";
  if (/fn main|String::|println!|let mut|&mut|error\[E\d+\]/.test(code)) return "rust";
  if (/using Orleans|IGrain|Task<|Dictionary<|HashSet<|public async Task/.test(code)) return "csharp";
  if (/^\s*(SELECT|UPDATE|INSERT|DELETE|CREATE|WITH|EXPLAIN)\b/im.test(code)) return "sql";
  if (/import numpy|matplotlib|plt\.|np\.|def\s+\w+\(|for _ in range/.test(code)) return "python";
  if (/const .*=>|Array\.from|console\./.test(code)) return "javascript";
  if (/var .* \*\w+|casitem|loaditem/.test(code)) return "go";
  return "";
}

function fenceCodeBlocks(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inFence = false;

  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push(line);
      i += 1;
      continue;
    }
    if (inFence || !isCodeFenceCandidate(lines, i)) {
      out.push(line);
      i += 1;
      continue;
    }

    const block = [];
    let j = i;
    while (j < lines.length) {
      if (/^\s*(```|~~~)/.test(lines[j])) break;
      if (isCodeFenceCandidate(lines, j)) {
        block.push(cleanCodeLine(lines[j]));
        j += 1;
        continue;
      }
      if (!lines[j].trim() && isCodeFenceCandidate(lines, j + 1)) {
        block.push("");
        j += 1;
        continue;
      }
      break;
    }

    const meaningfulLines = block.filter((item) => item.trim()).length;
    if (meaningfulLines < 2) {
      out.push(line);
      i += 1;
      continue;
    }

    const language = inferCodeLanguage(block);
    out.push(`\`\`\`${language}`, ...block, "```");
    i = j;
  }

  return out.join("\n");
}

function embedMedia(md) {
  return md.replace(/^\[Embedded media\]\(([^)]+)\)$/gm, (_, src) => {
    return `<div class="video-embed"><iframe src="${src}" title="Embedded media" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
  });
}

function markMath(segments, latex) {
  const normalized = latex
    .replace(/\s+/g, " ")
    .replace(/\s+([,;)])/g, "$1")
    .replace(/([,(])\s+/g, "$1")
    .trim();
  return `@@MATH${segments.push(normalized) - 1}@@`;
}

function latexSymbol(value) {
  return value
    .replace(/\\_/g, "_")
    .replace(/\\([<>|])/g, "$1")
    .replace(/[ –—−]/g, "-")
    .replace(/’/g, "'")
    .replace(/∗/g, "*")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/λ_([A-Za-z0-9]+)/g, "\\lambda_{$1}")
    .replace(/λ/g, "\\lambda")
    .replace(/[∆Δ]_?([A-Za-z0-9]+)/g, "\\Delta_{$1}")
    .replace(/[∆Δ]/g, "\\Delta")
    .replace(/β²/g, "\\beta^2")
    .replace(/β/g, "\\beta")
    .replace(/α/g, "\\alpha")
    .replace(/δ/g, "\\delta")
    .replace(/ε/g, "\\epsilon")
    .replace(/([A-Za-z])\*/g, "$1^*")
    .replace(/([A-Za-z])'/g, "$1'")
    .replace(/argmin/g, "\\operatorname{argmin}")
    .replace(/Pr\(/g, "\\Pr(")
    .replace(/\bIOU\b/g, "\\operatorname{IOU}")
    .replace(/\bObject\b/g, "\\mathrm{Object}")
    .replace(/\bClass_i\b/g, "\\mathrm{Class}_i")
    .replace(/\|/g, "\\mid ")
    .replace(/\*\s*/g, "\\cdot ")
    .replace(/\\?\$([A-Za-z0-9_]+)/g, "$1")
    .trim();
}

function latexFormula(value) {
  return latexSymbol(value)
    .replace(/\|\|(.+?)\|\|/g, "\\lVert $1 \\rVert")
    .replace(/\\mid \\mid (.+?)\\mid \\mid/g, "\\lVert $1 \\rVert")
    .replace(/\s+/g, " ")
    .trim();
}

function isMathStrong(value) {
  const plain = value.replace(/<[^>]+>/g, "").trim();
  if (!plain || /[\u3131-\uD79D]/.test(plain)) return false;
  if (/^\\?\$\d/.test(plain)) return false;
  if (plain.length > 80) return false;
  return /(Pr\(|λ|∆|Δ|δ|β|α|ε|[_=<>≤≥|]|\\[<>|]|\*|²|L\(\$b_last\))/.test(plain);
}

function isCodeLikeLine(line) {
  const trimmed = line.trim();
  return /^(fn|let|var|const|await|public|private|SELECT|UPDATE|if|for|return|\.)\b/.test(trimmed)
    || /[{};]/.test(trimmed)
    || /=>|=\>/.test(trimmed);
}

function latexizeMathLine(line) {
  if (/^\s*!\[[^\]]*\]\(/.test(line) || isCodeLikeLine(line)) return line;

  const segments = [];
  const inlineMathInText = (value) => {
    const localSegments = [];
    const replaced = value
      .replace(/[∆Δ](kv|attn)\b/g, (_, name) => markMath(localSegments, `\\Delta_{${name}}`))
      .replace(/[∆Δ]i\b/g, () => markMath(localSegments, "\\Delta_i"))
      .replace(/λ_(coord|noobj|cls|rec)\b/g, (_, name) => markMath(localSegments, `\\lambda_{${name}}`))
      .replace(/β²/g, () => markMath(localSegments, "\\beta^2"))
      .replace(/\b([αβδελ])\b/g, (_, symbol) => markMath(localSegments, latexSymbol(symbol)));
    return replaced.replace(/@@MATH(\d+)@@/g, (_, index) => `$${localSegments[Number(index)]}$`);
  };
  let out = line
    .replace(/<strong>Pr\(Class_i\s*\\?\|Object\)\s*<\/strong>\s*Pr\(Object\)\s*\*\s*IOU\s*=\s*Pr\(Class_i\)\s*<strong>\s*IOU<\/strong>/g, () => {
      return markMath(segments, "\\Pr(\\mathrm{Class}_i \\mid \\mathrm{Object}) \\cdot \\Pr(\\mathrm{Object}) \\cdot \\operatorname{IOU} = \\Pr(\\mathrm{Class}_i) \\cdot \\operatorname{IOU}");
    })
    .replace(/<strong>S x S x \(B\s*<\/strong>\s*5 \+ C\)/g, () => {
      return markMath(segments, "S \\times S \\times (B \\cdot 5 + C)");
    })
    .replace(/<strong>([^<]+)<\/strong>/g, (match, value) => {
      if (!isMathStrong(value)) return match;
      let content = value.trim();
      if (/[A-Za-z]\s+[A-Za-z]/.test(content) && /[λ∆Δδβγε]/.test(content)) {
        return `<strong>${inlineMathInText(content)}</strong>`;
      }
      let suffix = "";
      if (content.endsWith(")") && !content.includes("(")) {
        content = content.slice(0, -1);
        suffix = ")";
      }
      return `${markMath(segments, latexFormula(content))}${suffix}`;
    })
    .replace(/\*([A-Za-z][’']?\s*\\?[<>]\s*[A-Za-z][’']?)\*/g, (_, value) => {
      return markMath(segments, latexFormula(value));
    })
    .replace(/\(p\*\s*=\s*argmin\((?:\\?\|){2}p.*?q(?:\\?\|){2}\)\)/g, () => {
      return `(${markMath(segments, "p^* = \\operatorname{argmin}(\\lVert p - q \\rVert)")})`;
    })
    .replace(/\b3\s+ln\s+n\s*\/\s*ln\s+ln\s+n\b/g, () => {
      return markMath(segments, "\\frac{3 \\ln n}{\\ln \\ln n}");
    })
    .replace(/\bln\s+ln\s+n\s*\/\s*ln\s+2\s*\+\s*O\(1\)/g, () => {
      return markMath(segments, "\\frac{\\ln \\ln n}{\\ln 2} + O(1)");
    })
    .replace(/\bO\(1[–-]10\)ms\b/g, () => {
      return markMath(segments, "O(1-10)\\,\\mathrm{ms}");
    })
    .replace(/\(L\s+\\\\\s+V\)/g, () => `(${markMath(segments, "L \\setminus V")})`)
    .replace(/d\(p,\s*p’\)\s*\\?>\s*d\(p,\s*p\*\)/g, () => {
      return markMath(segments, "d(p, p') > d(p, p^*)");
    })
    .replace(/0\s*\\?<\s*β\s*≤\s*1/g, () => markMath(segments, "0 < \\beta \\le 1"))
    .replace(/λ_(coord|noobj|cls|rec)\b/g, (_, name) => markMath(segments, `\\lambda_{${name}}`))
    .replace(/[∆Δ](kv|attn)\b/g, (_, name) => markMath(segments, `\\Delta_{${name}}`))
    .replace(/[∆Δ]i\b/g, () => markMath(segments, "\\Delta_i"))
    .replace(/β²/g, () => markMath(segments, "\\beta^2"))
    .replace(/\|d\|\s*≤\s*<strong>ε<\/strong>/g, () => markMath(segments, "\\lvert d \\rvert \\le \\epsilon"))
    .replace(/\ba\s*\\?<\s*ε\b/g, () => markMath(segments, "a < \\epsilon"))
    .replace(/\bp\*/g, () => markMath(segments, "p^*"))
    .replace(/\bp’/g, () => markMath(segments, "p'"));

  return out.replace(/@@MATH(\d+)@@/g, (_, index) => `$${segments[Number(index)]}$`);
}

function latexizeMath(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;

  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    return latexizeMathLine(line);
  }).join("\n");
}

function htmlizeBold(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;

  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    return line
      .replace(/\[\*\*([^\]]+?)\*\*\]\(([^)]+)\)/g, "[$1]($2)")
      .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*\*/g, "");
  }).join("\n");
}

function fixUnbalancedEmphasis(line) {
  let fixed = line
    .replace(/(\S)\*\*,\s*/g, "$1, **")
    .replace(/(\]\([^)]+\))\*{2,4}$/g, "$1");

  const strongCount = (fixed.match(/\*\*/g) ?? []).length;
  if (strongCount % 2 === 1 && /\s+\*\*\s*$/.test(fixed)) {
    fixed = fixed.replace(/\s+\*\*\s*$/, "");
  }

  fixed = fixed
    .replace(/(^|\s|[-*>]\s*)\*(?!\*)([^*\n]+?)\*\*(?=$|\s|[.,:;)])/g, "$1**$2**")
    .replace(/\*\*([^*\n]+?)\*(?=$|\s|[.,:;)])/g, "**$1**");

  return fixed.replace(/\*{3,}/g, "**");
}

function cleanEmphasisArtifacts(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;

  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    return fixUnbalancedEmphasis(line
      .replace(/\\\*/g, "*")
      .replace(/\*{3,}/g, "**")
      .replace(/\*\\\*/g, "**")
      .replace(/\*\*\s+\*\*/g, " ")
      .replace(/\u00a0/g, " "));
  }).join("\n");
}

function stripHeadingFormatting(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;

  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!heading) return line;

    const text = heading[2]
      .replace(/\*{1,3}/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return `${heading[1]} ${text}`;
  }).join("\n");
}

function normalizeHeadingLevels(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;

  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!heading) return line;

    const sourceLevel = heading[1].length;
    const targetLevel = sourceLevel <= 3 ? 2 : 3;
    return `${"#".repeat(targetLevel)} ${heading[2]}`;
  }).join("\n");
}

function headingTextKey(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/[`*_~\\|()[\]{}:;,.!?'"“”‘’]/g, "")
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩❶❷❸❹❺❻❼❽❾❿]/g, "")
    .replace(/^\s*(?:\d+\.|\(\d+\))\s*/g, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();
}

function isTocHeading(value) {
  const key = headingTextKey(value);
  return key === "index"
    || key === "tableofcontents"
    || key === "toc"
    || key === "구성"
    || key === "소개순서";
}

function isNumberedHeading(value) {
  return /^\s*(?:[①②③④⑤⑥⑦⑧⑨⑩❶❷❸❹❺❻❼❽❾❿]|\(\d+\)|\d+\.)/.test(value);
}

function addTocKey(keys, value) {
  const cleaned = value
    .replace(/<[^>]+>/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/^\s*[-*+]\s*/, "")
    .trim();
  if (!cleaned) return;

  const pieces = [cleaned, ...cleaned.split(/\s+-\s+|(?<=\S)-\s+(?=\S)/g)];
  for (const piece of pieces) {
    const key = headingTextKey(piece);
    if (key.length >= 2) keys.add(key);
  }
}

function collectTocKeys(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const keys = new Set();
  let inFence = false;
  let inToc = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      inToc = isTocHeading(heading[2]);
      continue;
    }

    if (!inToc) continue;
    if (!line.trim()) continue;
    if (/^\s*[-*+]\s+/.test(line)) {
      addTocKey(keys, line);
      continue;
    }
    inToc = false;
  }

  return keys;
}

function matchesTocKey(value, keys) {
  const key = headingTextKey(value);
  if (!key || keys.size === 0) return false;
  for (const tocKey of keys) {
    if (key === tocKey || tocKey.includes(key) || key.includes(tocKey)) return true;
  }
  return false;
}

function normalizeHeadingHierarchy(md, tocKeys) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;

  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!heading) return line;

    const text = heading[2];
    if (heading[1].length === 3 && !isTocHeading(text) && matchesTocKey(text, tocKeys)) {
      return `## ${text}`;
    }

    return line;
  }).join("\n");
}

function standaloneBoldTitle(line) {
  const trimmed = line.trim().replace(/\s*\\\s*$/, "").trim();
  if (!trimmed || /^#{1,6}\s/.test(trimmed)) return "";
  if (/^(-|\d+\.|>|\||!|\[)/.test(trimmed)) return "";

  const numberedBold = /^(?<prefix>[①-⑳❶-❿0-9().\s]+)\*\*(?<title>.+?)\*\*$/.exec(trimmed);
  if (numberedBold) {
    return `${numberedBold.groups.prefix.trim()} ${numberedBold.groups.title.trim()}`.trim();
  }

  const compact = trimmed.replace(/\*\*\s+\*\*/g, " ");
  const matches = [...compact.matchAll(/\*{2,3}(.+?)\*{2,3}/g)];
  if (!matches.length) return "";

  const remainder = compact.replace(/\*{2,3}.+?\*{2,3}/g, "").trim();
  if (remainder) return "";

  const title = matches.map((match) => match[1].replace(/^\*+|\*+$/g, "").trim()).filter(Boolean).join(" ");
  const plain = title.replace(/[`*_\\]/g, "").trim();
  if (!plain || plain.length > 90) return "";
  return plain;
}

function promoteStandaloneBoldHeadings(md, tocKeys = new Set()) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;
  let lastHeadingLevel = 0;

  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    const heading = /^(#{1,6})\s+/.exec(line);
    if (heading) {
      lastHeadingLevel = heading[1].length;
      return line;
    }

    const title = standaloneBoldTitle(line);
    if (!title) return line;

    const level = matchesTocKey(title, tocKeys)
      ? 2
      : lastHeadingLevel >= 3 ? 3 : 2;
    return `${"#".repeat(level)} ${title}`;
  }).join("\n");
}

function plainBodyMetrics(markdown) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[#>*_`\-[\]()|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const lines = markdown.split("\n").map((line) => line.trim()).filter((line) => {
    if (!line) return false;
    if (/^!\[[^\]]*\]\([^)]*\)$/.test(line)) return false;
    return true;
  }).length;
  return { chars: plain.length, lines };
}

function isShortPost(markdown) {
  const { chars, lines } = plainBodyMetrics(markdown);
  return chars < 500 || lines <= 5;
}

function convertHtmlToMarkdown(html) {
  if (!html) return "";
  return execFileSync("pandoc", [
    "--from=html",
    "--to=gfm-raw_html",
    "--wrap=none",
  ], {
    input: html,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 32,
  });
}

if (!existsSync(postsDir)) {
  throw new Error(`Missing Medium posts directory: ${postsDir}`);
}

mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(outDir)) {
  if (file.endsWith(".md") && file !== "_index.md") {
    unlinkSync(join(outDir, file));
  }
}

let migrated = 0;
let drafts = 0;
let skippedShort = 0;
let skippedExcluded = 0;
const files = execFileSync("powershell", [
  "-NoProfile",
  "-Command",
  "Get-ChildItem -LiteralPath 'backup/posts' -Filter '*.html' -File | Sort-Object Name | ForEach-Object { $_.FullName }",
], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

for (const file of files) {
  const html = readFileSync(file, "utf8");
  const fileName = basename(file);
  const title = stripTags(extract(html, /<h1[^>]*class=["'][^"']*\bp-name\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i))
    || stripTags(extract(html, /<title>([\s\S]*?)<\/title>/i))
    || fileName.replace(/\.html$/i, "");
  if (excludedTitles.has(title)) {
    skippedExcluded += 1;
    continue;
  }
  const description = stripTags(extract(html, /<section\s+data-field=["']subtitle["'][^>]*>([\s\S]*?)<\/section>/i));
  const date = extract(html, /<time[^>]*class=["'][^"']*\bdt-published\b[^"']*["'][^>]*datetime=["']([^"']+)["']/i)
    || dateFromFileName(fileName);
  const canonicalTag = extract(html, /(<a[^>]*class=["'][^"']*\bp-canonical\b[^"']*["'][^>]*>)/i);
  const canonical = extractAttr(canonicalTag, "href");
  const slug = slugFrom(fileName, canonical);
  const isDraft = fileName.startsWith("draft_");
  const bodyHtml = extractBody(html);
  const markdown = normalizeMarkdown(convertHtmlToMarkdown(bodyHtml));
  if (isShortPost(markdown)) {
    skippedShort += 1;
    continue;
  }

  const frontMatter = [
    "---",
    `title: ${frontMatterValue(title)}`,
    `date: ${frontMatterValue(date)}`,
    `slug: ${frontMatterValue(slug)}`,
    description ? `description: ${frontMatterValue(description)}` : "",
    isDraft ? "draft: true" : "",
    "tags: []",
    "---",
    "",
  ].filter((line) => line !== "").join("\n");

  const output = join(outDir, `${fileName.replace(/\.html$/i, ".md")}`);
  writeFileSync(output, `${frontMatter}\n\n${markdown}\n`, "utf8");
  migrated += 1;
  if (isDraft) drafts += 1;
}

const legacySample = join(outDir, "markdown-syntax.md");
if (existsSync(legacySample)) rmSync(legacySample);

console.log(`Migrated ${migrated} Medium posts to ${outDir}`);
console.log(`Draft posts preserved as draft: ${drafts}`);
console.log(`Skipped short note/comment-like posts: ${skippedShort}`);
console.log(`Skipped excluded posts: ${skippedExcluded}`);
