import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const targets = [
  path.join(rootDir, "index.js"),
  path.join(rootDir, "src"),
  path.join(rootDir, "scripts"),
  path.join(rootDir, "test"),
];

function collectJsFiles(targetPath) {
  if (!fs.existsSync(targetPath)) return [];

  const stats = fs.statSync(targetPath);
  if (stats.isFile()) {
    return /\.(js|mjs)$/i.test(targetPath) ? [targetPath] : [];
  }

  return fs
    .readdirSync(targetPath, { withFileTypes: true })
    .flatMap((entry) => collectJsFiles(path.join(targetPath, entry.name)));
}

const files = [...new Set(targets.flatMap(collectJsFiles))];

for (const filePath of files) {
  execFileSync(process.execPath, ["--check", filePath], {
    stdio: "inherit",
  });
}

console.log(`Syntax OK for ${files.length} files.`);
