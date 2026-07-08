#!/usr/bin/env node
/**
 * Removes only HTML files from dist/public before a Vite rebuild.
 * Hashed assets (*.css, *.js with content hash) are intentionally kept
 * so users with open browser tabs don't get MIME-type errors during the
 * rebuild window. Old assets are overwritten by Vite when their content changes.
 */
import { readdirSync, rmSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist", "public");

if (!existsSync(distDir)) {
  console.log("clean-html: dist/public not found, skipping");
  process.exit(0);
}

let removed = 0;

function cleanHtml(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      cleanHtml(full);
    } else if (entry.endsWith(".html")) {
      rmSync(full);
      removed++;
    }
  }
}

cleanHtml(distDir);
console.log(`clean-html: removed ${removed} HTML file(s) from dist/public`);
