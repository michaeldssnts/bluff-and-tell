import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const stack = process.argv[2];
if (!stack || !/^[a-zA-Z][a-zA-Z0-9-]{0,127}$/.test(stack)) {
  console.error("Usage: node scripts/publish-assets.mjs bluff-and-tell");
  process.exit(1);
}
function run(args) {
  const result = spawnSync("aws", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}
const output = JSON.parse(
  run([
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    stack,
    "--query",
    "Stacks[0].Outputs",
    "--output",
    "json",
  ]),
);
const get = (name) => output.find((x) => x.OutputKey === name)?.OutputValue;
if (!get("WebsiteBucket") || !get("DistributionId"))
  throw new Error("Stack is missing the expected Bluff & Tell outputs.");
const dir = fileURLToPath(new URL("../public/", import.meta.url));
run([
  "s3",
  "sync",
  dir,
  "s3://" + get("WebsiteBucket") + "/",
  "--cache-control",
  "public,max-age=3600",
]);
for (const file of ["index.html", "sw.js", "manifest.webmanifest"])
  run([
    "s3",
    "cp",
    dir + file,
    "s3://" + get("WebsiteBucket") + "/" + file,
    "--cache-control",
    "no-cache",
  ]);
run([
  "cloudfront",
  "create-invalidation",
  "--distribution-id",
  get("DistributionId"),
  "--paths",
  "/*",
]);
console.log("Website uploaded: " + get("WebsiteURL"));
