#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(repoRoot, "apps", "pi-extension");
const piRoot = join(homedir(), ".pi");
const dest = join(piRoot, "agent", "extensions", "plannotator");
const safeExtensionsRoot = join(piRoot, "agent", "extensions");
const noInstall = process.argv.includes("--no-install");

function assertInside(child: string, parent: string) {
	const rel = relative(parent, child);
	if (rel === "" || rel.startsWith("..") || rel.includes(`..${sep}`)) {
		throw new Error(`Refusing to operate outside ${parent}: ${child}`);
	}
}

function shouldCopy(path: string) {
	const name = basename(path);
	return name !== "node_modules" && name !== ".git" && name !== ".DS_Store";
}

function normalizeVendoredPackageJson() {
	const packageJsonPath = join(dest, "package.json");
	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	packageJson.name = "plannotator";
	delete packageJson.license;
	delete packageJson.scripts;
	packageJson.pi = {
		extensions: ["./index.ts"],
		skills: ["./skills"],
	};
	writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

if (!existsSync(source)) {
	throw new Error(`Source extension not found: ${source}`);
}
if (!existsSync(join(piRoot, "package.json"))) {
	throw new Error(`Pi workspace package.json not found: ${join(piRoot, "package.json")}`);
}

assertInside(dest, safeExtensionsRoot);
mkdirSync(dirname(dest), { recursive: true });

if (existsSync(dest)) {
	rmSync(dest, { recursive: true, force: true });
}
cpSync(source, dest, { recursive: true, filter: shouldCopy });
normalizeVendoredPackageJson();

console.log(`Synced Plannotator Pi extension:`);
console.log(`  ${source}`);
console.log(`  -> ${dest}`);

if (!noInstall) {
	console.log("Running bun install in ~/.pi...");
	const result = spawnSync("bun", ["install"], { cwd: piRoot, stdio: "inherit" });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}
