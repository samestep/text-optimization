import parsePath from "parse-svg-path";
import { ElementNode, Node, parse as parseSVG } from "svg-parser";
import { Segment, strings } from "./common.js";

const element = (node: Node | string): ElementNode => {
  if (typeof node === "string") throw Error(`string: ${node}`);
  if (node.type === "text") throw Error(`text: ${node}`);
  return node;
};

const parseDef = (node: ElementNode): Segment[] => {
  if (node.tagName !== "path") throw Error(`not path: ${node.tagName}`);
  return parsePath(node.properties.d as string);
};

const paths: Record<string, Segment[]> = {};

for (const key of strings.keys()) {
  const root = parseSVG(await Bun.file(`svgs/${key}.svg`).text());
  const defs = element(
    element(element(root.children[0]).children[0]).children[0],
  );
  if (defs.tagName !== "defs") throw Error(`not defs: ${defs.tagName}`);
  if (defs.children.length !== 1)
    throw Error(
      `expected exactly one def for ${key}, got ${defs.children.length}`,
    );
  paths[key] = parseDef(element(defs.children[0]));
}

await Bun.write("paths.json", JSON.stringify(paths, null, 2));
