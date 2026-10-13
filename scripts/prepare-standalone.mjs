import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standaloneRoot = join(root, ".next", "standalone");

cpSync(join(root, ".next", "static"), join(standaloneRoot, ".next", "static"), {
  recursive: true,
});

const publicDir = join(root, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, join(standaloneRoot, "public"), { recursive: true });
}
