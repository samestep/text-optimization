#!/usr/bin/env bun

import mathjax from "mathjax";
import * as fs from "node:fs";
import { strings } from "./common.js";

const MathJax = await mathjax.init({
  loader: { load: ["input/tex", "output/svg"] },
});
const adaptor = MathJax.startup.adaptor;

const dir = "svgs";
fs.mkdirSync(dir, { recursive: true });

for (const [key, tex] of strings) {
  const svg = MathJax.tex2svg(tex, { em: 16, ex: 8, display: false });
  const serializedSvg = adaptor.outerHTML(svg);

  const filename = `${dir}/${key}.svg`;
  await Bun.write(filename, serializedSvg);
}
