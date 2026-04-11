import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = ["src/components", "src/layouts"];
const ALLOWED_LITERALS = new Set(["close", "placeholder"]);

const ATTRIBUTE_REGEX = /\b(?:aria-label|placeholder|title|data-tip)\s*=\s*"([^"{][^"]*)"/g;
const TEXT_NODE_REGEX = />\s*([A-Za-z][^<{}]*)\s*</g;

async function getFilesRecursively(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) return getFilesRecursively(absolutePath);
      if (!entry.name.endsWith(".svelte") && !entry.name.endsWith(".astro"))
        return [];
      return [absolutePath];
    }),
  );
  return files.flat();
}

function isCandidateLiteral(text) {
  const normalized = text.trim();
  if (!normalized) return false;
  if (ALLOWED_LITERALS.has(normalized.toLowerCase())) return false;
  if (!/[A-Za-z]/.test(normalized)) return false;
  return true;
}

function collectCandidates(content) {
  const contentWithoutScripts = content.replace(
    /<script[\s\S]*?<\/script>/g,
    "",
  );
  const matches = [];
  for (const regex of [ATTRIBUTE_REGEX, TEXT_NODE_REGEX]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(contentWithoutScripts)) !== null) {
      const value = match[1]?.trim();
      if (!isCandidateLiteral(value)) continue;
      matches.push(value);
    }
  }
  return [...new Set(matches)];
}

async function main() {
  const targetPaths = TARGET_DIRS.map((dir) => path.join(ROOT, dir));
  const files = (await Promise.all(targetPaths.map(getFilesRecursively))).flat();
  let hasCandidates = false;

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    const candidates = collectCandidates(content);
    if (candidates.length === 0) continue;
    hasCandidates = true;
    const relativePath = path.relative(ROOT, filePath);
    console.log(`\n${relativePath}`);
    for (const candidate of candidates) console.log(`  - ${candidate}`);
  }

  if (!hasCandidates) {
    console.log("No hardcoded UI text candidates found.");
    return;
  }

  console.log(
    "\nReview the candidates above and move user-facing strings into src/locales/EN.json when applicable.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
