#!/usr/bin/env node
/**
 * Package beatlounge.zip — the sideloadable pack (manifest + built dist/).
 *
 * Includes manifest.json and dist/ (app.js, app.css, and any public/ assets
 * copied into dist/ by the vite build).
 *
 * Usage:
 *   node scripts/pack.mjs          # package only (assumes dist/ exists)
 *   npm run pack:all               # build + package
 */
import { existsSync } from "node:fs"
import { rm } from "node:fs/promises"
import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")

async function main() {
  if (!existsSync(path.join(packRoot, "dist", "app.js"))) {
    console.error("dist/app.js not found. Run 'npm run build' first.")
    process.exit(1)
  }

  const zipPath = path.join(packRoot, "beatlounge.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  console.log("Creating beatlounge.zip...")
  execSync("zip -r beatlounge.zip manifest.json dist/", {
    cwd: packRoot,
    stdio: "inherit",
  })

  console.log("\nDone! beatlounge.zip is ready.")
}

main()
