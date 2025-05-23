const esbuild = require("esbuild");
const path = require("path");


esbuild.build({
  entryPoints: [path.resolve(__dirname, "src", "index.js")],
  outfile: "dist/bearmq.js",
  platform: "node",
  format: "cjs",
  bundle: true,
  minify: true,
  sourcemap: false,
   external: ['ws'],
  target: ["es2015"]
}).catch(() => process.exit(1));
