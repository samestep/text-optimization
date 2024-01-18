#!/usr/bin/env bun

import { mkdir } from "fs/promises";

type Segment = [string, ...number[]];

const polygonize = (path: Segment[]): [number, number][] => {
  const poly: [number, number][] = [];
  let x: number = NaN;
  let y: number = NaN;
  for (const [kind, ...nums] of path) {
    switch (kind) {
      case "M": {
        [x, y] = nums;
        poly.push([x, y]);
        break;
      }
      case "L": {
        [x, y] = nums;
        poly.push([x, y]);
        break;
      }
      case "H": {
        [x] = nums;
        poly.push([x, y]);
        break;
      }
      case "V": {
        [y] = nums;
        poly.push([x, y]);
        break;
      }
      case "Z": {
        poly.pop(); // our examples always duplicate the last point
        return poly; // just the outer boundary
      }
      case "C": {
        [, , , , x, y] = nums;
        poly.push([x, y]);
        break;
      }
      default:
        throw Error(`unknown kind: ${kind}`);
    }
  }
  throw Error("no Z");
};

const paths: Record<string, Segment[]> = JSON.parse(
  await Bun.file("paths.json").text(),
);

const dir = "polygons";
await mkdir(dir, { recursive: true });
for (const [key, path] of Object.entries(paths)) {
  const poly = polygonize(path);
  const lines = [`${poly.length}`];
  // CGAL only likes integers apparently
  for (const [x, y] of poly) lines.push(`${x} ${y}`);
  await Bun.write(`${dir}/${key}.dat`, lines.join("\n"));
}
