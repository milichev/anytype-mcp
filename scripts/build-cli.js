import * as esbuild from "esbuild";
import { readFileSync } from "fs";
import { chmod } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
  const instructions = readFileSync(join(__dirname, "../instructions.md"), "utf8");

  await esbuild.build({
    entryPoints: [join(__dirname, "start-server.ts")],
    bundle: true,
    minify: true,
    platform: "node",
    target: "node18",
    format: "esm",
    outfile: "bin/cli.mjs",
    banner: {
      js: "#!/usr/bin/env node\nimport { createRequire } from 'module';const require = createRequire(import.meta.url);", // see https://github.com/evanw/esbuild/pull/2067
    },
    external: ["util"],
    define: {
      __BUNDLED_INSTRUCTIONS__: JSON.stringify(instructions),
    },
  });

  // Make the output file executable
  await chmod("./bin/cli.mjs", 0o755);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
