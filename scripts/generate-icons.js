#!/usr/bin/env node
/**
 * Generates PNG icons from public/icon.svg.
 * Run once after npm install: node scripts/generate-icons.js
 * Requires: npm install -D sharp
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("Please run: npm install -D sharp");
  process.exit(1);
}

const svgPath = path.join(publicDir, "icon.svg");
const svg = readFileSync(svgPath);

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-180.png", size: 180 },
];

for (const { name, size } of sizes) {
  const outPath = path.join(publicDir, name);
  await sharp(svg).resize(size, size).png().toFile(outPath);
  console.log(`Generated ${name}`);
}

console.log("Done! Icons are in public/");
