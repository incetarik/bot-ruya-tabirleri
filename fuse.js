const { task, context } = require("fuse-box/sparky");
const { FuseBox, QuantumPlugin, JSONPlugin, EnvPlugin } = require("fuse-box");
context(
  class {
    getConfig() {
      return FuseBox.init({
        homeDir: "src",
        target: "server@es5",
        output: "dist/bundled-$name.js",
        plugins: [
          JSONPlugin(),
          EnvPlugin({ NODE_ENV: 'production', }),
          this.isProduction &&
            QuantumPlugin({
              uglify: true,
              treeshake: true,
              bakeApiIntoBundle: "app",
            }),
        ],
      });
    }
  },
);

task("default", async context => {
  const fuse = context.getConfig();

  fuse
    .bundle("app")
    .hmr()
    .watch()
    .instructions(">index.ts");

  await fuse.run();
});

task("dist", async context => {
  context.isProduction = true;
  const fuse = context.getConfig();
  fuse.bundle("app").hmr().watch().instructions(">index.ts");

  await fuse.run();
});
