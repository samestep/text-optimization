#!/usr/bin/env bun

import { mkdir } from "fs/promises";

const keys = Object.keys(JSON.parse(await Bun.file("paths.json").text()));
const dir = "pairs";
mkdir(dir, { recursive: true });
for (const a of keys) {
  for (const b of keys) {
    console.log(`${a}-${b}`);
    const proc = Bun.spawn([
      "target/release/text-optimization",
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
