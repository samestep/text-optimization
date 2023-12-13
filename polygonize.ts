import { Segment } from "./common.js";

const paths: Record<string, Segment[]> = JSON.parse(
  await Bun.file("paths.json").text(),
);

const polygons = {};

for (const [key, path] of Object.entries(paths)) {
  const polys = [];
  let poly = [];
  let x: number;
  let y: number;
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
        polys.push(poly);
        poly = [];
        break;
      }
      case "Q": {
        [, , x, y] = nums;
        poly.push([x, y]);
        break;
      }
      case "T": {
        [x, y] = nums;
        poly.push([x, y]);
        break;
      }
      default:
        throw Error(`unknown kind: ${kind}`);
    }
  }

  polygons[key] = polys;
}

await Bun.write("polygons.json", JSON.stringify(polygons, null, 2));
