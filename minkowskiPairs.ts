import * as fs from "node:fs";
import { strings } from "./common.js";

const dir = "pairs";
fs.mkdirSync(dir, { recursive: true });

for (const a of strings.keys()) {
  for (const b of strings.keys()) {
    console.log(`${a}-${b}`);

    // run the command `./minkowski_diff ${a} ${b} > pairs/${a}-${b}.dat`
    const proc = Bun.spawn([
      "./minkowski_diff",
      `polygons/${a}.dat`,
      `polygons/${b}.dat`,
    ]);
    const text = await new Response(proc.stdout).text();
    await Bun.write(`pairs/${a}-${b}.dat`, text);
  }
}
