#!/usr/bin/env bun

import { readdir } from "fs/promises";
import parsePath from "parse-svg-path";
import { basename } from "path";
import { ElementNode, Node, parse } from "svg-parser";

const element = (node: Node | string): ElementNode => {
  if (typeof node === "string") throw Error(`string: ${node}`);
  if (node.type === "text") throw Error(`text: ${node}`);
  return node;
};

type Segment = [string, ...number[]];

const paths: Record<string, Segment[]> = {};

const dir = "svgs";
for (const filename of await readdir(dir)) {
  const root = await Bun.file(`${dir}/${filename}`).text();
  const path = element(element(parse(root).children[0]).children[0]);
  paths[basename(filename, ".svg")] = parsePath(path.properties?.d);
}

await Bun.write("paths.json", JSON.stringify(paths, null, 2));
