#!/usr/bin/env bun

import * as fs from "node:fs";

const polygons: Record<string, [number, number][][]> = JSON.parse(
  await Bun.file("polygons.json").text(),
);

const dir = "polygons";
fs.mkdirSync(dir, { recursive: true });

for (const [key, polys] of Object.entries(polygons)) {
  const poly = polys[0]; // just the outer boundary

  const first = poly[0];
  const last = poly[poly.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    poly.pop();
  }

  const lines = [`${poly.length}`];
  for (const [x, y] of poly) {
    lines.push(`${x} ${y}`);
  }

  const filename = `${dir}/${key}.dat`;
  await Bun.write(filename, lines.join("\n"));
}
