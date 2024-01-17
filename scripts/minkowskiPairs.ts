#!/usr/bin/env bun

import * as fs from "node:fs";
import { strings } from "./common.js";

const dir = "public/pairs";
fs.mkdirSync(dir, { recursive: true });

for (const a of strings.keys()) {
  for (const b of strings.keys()) {
    console.log(`${a}-${b}`);

    // run the command `./minkowski_diff ${a} ${b} > public/pairs/${a}-${b}.dat`
    const proc = Bun.spawn([
      "build/minkowski_diff",
      `polygons/${a}.dat`,
      `polygons/${b}.dat`,
    ]);
    await proc.exited;
    if (proc.signalCode) {
      console.error(`  error: ${proc.signalCode}`);
      continue;
    }
    const out = await new Response(proc.stdout).text();
    await Bun.write(`${dir}/${a}-${b}.dat`, out);
  }
}
