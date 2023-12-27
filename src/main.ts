import {
  Bool,
  Fn,
  Real,
  Vec,
  add,
  and,
  compile,
  div,
  fn,
  geq,
  gt,
  lt,
  mul,
  neg,
  not,
  or,
  select,
  sqrt,
  sub,
  vjp,
} from "rose";
import * as lbfgs from "./lbfgs.js";
import paths from "./paths.json";
import safe from "./safe.txt?raw";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const ratio = window.devicePixelRatio;
const setSize = () => {
  const html = document.documentElement;
  const width = html.clientWidth;
  const height = html.clientHeight;
  const w = width * ratio;
  const h = height * ratio;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
};
setSize();
window.onresize = setSize;

ctx.font = "100px sans-serif";
ctx.fillText("loading...", 100, 200);

let letters = safe.trimEnd().split("\n");
// right now we can't handle all the letters at once, it would crash :(
letters = [
  "lower_alpha",
  "lower_beta",
  "lower_gamma",
  "lower_delta",
  "lower_varepsilon",
  "lower_zeta",
  "lower_eta",
  "lower_theta",
  "lower_iota",
  "lower_kappa",
  "lower_lambda",
  "lower_mu",
  "lower_nu",
];

const max = (a: Real, b: Real) => select(gt(a, b), Real, a, b);

const min = (a: Real, b: Real) => select(lt(a, b), Real, a, b);

const clamp = (x: Real, l: Real, h: Real) =>
  select(lt(x, l), Real, l, select(lt(h, x), Real, h, x));

const all = (xs: Bool[]): Bool => xs.reduce((a, b) => and(a, b));

const vnot = (xs: Bool[]): Bool[] => xs.map((x) => not(x));

const vsub = (a: Real[], b: Real[]): Real[] => a.map((x, i) => sub(x, b[i]));

const vmul = (v: Real[], c: Real): Real[] => v.map((x) => mul(x, c));

const dot = (a: Real[], b: Real[]): Real =>
  a.map((x, i) => mul(x, b[i])).reduce((a, b) => add(a, b));

type Vec2 = [number, number];

// https://iquilezles.org/articles/distfunctions2d/
const sdPolygon = (v: Vec2[], p: [Real, Real]) => {
  const N = v.length;
  let d = dot(vsub(p, v[0]), vsub(p, v[0]));
  let s: Real = 1.0;
  for (let i = 0, j = N - 1; i < N; j = i, i++) {
    const e = vsub(v[j], v[i]);
    const w = vsub(p, v[i]);
    const b = vsub(w, vmul(e, clamp(div(dot(w, e), dot(e, e)), 0.0, 1.0)));
    d = min(d, dot(b, b));
    const c = [
      geq(p[1], v[i][1]),
      lt(p[1], v[j][1]),
      gt(mul(e[0], w[1]), mul(e[1], w[0])),
    ];
    s = select(or(all(c), all(vnot(c))), Real, neg(s), s);
  }
  return mul(s, sqrt(d));
};

const parseDat = (text: string): Vec2[] =>
  text
    .trimEnd()
    .split("\n")
    .slice(1)
    .map((line) => line.split(" ").map(parseFloat) as Vec2);

let selected: number | undefined = undefined;

interface Glyph {
  key: string;
  x: number;
  y: number;
}

const scale = 10;

const glyphs: Glyph[] = [
  { y: 1000, key: "lower_alpha", x: 500 },
  { y: 1000, key: "lower_beta", x: 1500 },
  { y: 1000, key: "lower_gamma", x: 2500 },

  { y: 2000, key: "lower_delta", x: 500 },
  { y: 2000, key: "lower_varepsilon", x: 1500 },
  { y: 2000, key: "lower_zeta", x: 2500 },

  { y: 3000, key: "lower_eta", x: 500 },
  { y: 3000, key: "lower_theta", x: 1500 },
  { y: 3000, key: "lower_iota", x: 2500 },

  { y: 4000, key: "lower_kappa", x: 500 },
  { y: 4000, key: "lower_lambda", x: 1500 },
  { y: 4000, key: "lower_mu", x: 2500 },

  { y: 5000, key: "lower_nu", x: 500 },
];

const sdfs = new Map<string, Fn & ((x: Real, y: Real) => Real)>();
for (let i = 0; i < letters.length; ++i) {
  const a = letters[i];
  for (let j = i; j < letters.length; ++j) {
    const b = letters[j];

    const text = await (
      await fetch(`/text-optimization/pairs/${a}-${b}.dat`)
    ).text();
    const poly = parseDat(text);

    const f = fn([Real, Real], Real, (x, y) => sdPolygon(poly, [x, y]));
    sdfs.set(`${a}-${b}`, f);
  }
}

const gap = 100;

const lagrangian = fn([Vec(glyphs.length, Vec(2, Real))], Real, (positions) => {
  let sum: Real = 0;
  const pairs: Real[][] = glyphs.map(() => []);
  for (let i = 0; i < glyphs.length; ++i) {
    for (let j = i + 1; j < glyphs.length; ++j) {
      const f = sdfs.get(`${glyphs[i].key}-${glyphs[j].key}`)!;
      const [ax, ay] = positions[i];
      const [bx, by] = positions[j];

      const z = f(sub(bx, ax), sub(ay, by));
      pairs[i][j] = z;
      pairs[j][i] = z;

      const w = max(0, sub(gap, z));
      sum = add(sum, mul(w, w));
    }
  }
  for (let i = 0; i < glyphs.length; ++i) {
    const j = (i + 1) % glyphs.length;
    const z = pairs[i][j];
    const w = max(0, sub(z, gap));
    sum = add(sum, mul(w, w));
  }
  return sum;
});
const gradient = await compile(
  fn(
    [Vec(glyphs.length, Vec(2, Real))],
    { ret: Real, grad: Vec(glyphs.length, Vec(2, Real)) },
    (positions) => {
      const { ret, grad } = vjp(lagrangian)(positions);
      return { ret, grad: grad(1) };
    },
  ),
);

type Segment = [string, ...number[]];

const drawPath = (path: Segment[]) => {
  ctx.beginPath();
  let x: number = NaN;
  let y: number = NaN;
  let cpx: number = NaN;
  let cpy: number = NaN;
  for (const [kind, ...nums] of path) {
    switch (kind) {
      case "M": {
        [x, y] = nums;
        ctx.moveTo(x, y);
        break;
      }
      case "L": {
        [x, y] = nums;
        ctx.lineTo(x, y);
        break;
      }
      case "H": {
        [x] = nums;
        ctx.lineTo(x, y);
        break;
      }
      case "V": {
        [y] = nums;
        ctx.lineTo(x, y);
        break;
      }
      case "Z": {
        ctx.closePath();
        break;
      }
      case "Q": {
        [cpx, cpy, x, y] = nums;
        ctx.quadraticCurveTo(cpx, cpy, x, y);
        break;
      }
      case "T": {
        cpx = 2 * x - cpx;
        cpy = 2 * y - cpy;
        [x, y] = nums;
        ctx.quadraticCurveTo(cpx, cpy, x, y);
        break;
      }
      default:
        throw Error(`unknown kind: ${kind}`);
    }
  }
};

const cfg: lbfgs.Config = {
  m: 17,
  armijo: 0.001,
  wolfe: 0.9,
  minInterval: 1e-9,
  maxSteps: 10,
  epsd: 1e-11,
};

const optimizer: lbfgs.Fn = (x: Float64Array, grad: Float64Array) => {
  // unflatten `x`, call `gradient`, then reflatten `grad`
  const positions: [number, number][] = [];
  for (let i = 0; i < glyphs.length; ++i)
    positions.push([x[2 * i], x[2 * i + 1]]);
  const { ret, grad: grads } = gradient(positions);
  for (let i = 0; i < glyphs.length; ++i) {
    const g = grads[i];
    grad[2 * i] = g[0];
    grad[2 * i + 1] = g[1];
  }
  return ret;
};

const getVarying = (): Float64Array => {
  const x = new Float64Array(2 * glyphs.length);
  for (let i = 0; i < glyphs.length; ++i) {
    x[2 * i] = glyphs[i].x;
    x[2 * i + 1] = glyphs[i].y;
  }
  return x;
};

const applyVarying = (x: Float64Array) => {
  // save selected position
  const { x: sx, y: sy } =
    selected === undefined ? { x: NaN, y: NaN } : glyphs[selected];

  for (let i = 0; i < glyphs.length; ++i) {
    glyphs[i].x = x[2 * i];
    glyphs[i].y = x[2 * i + 1];
  }

  // restore selected position
  if (selected !== undefined) {
    glyphs[selected!].x = sx;
    glyphs[selected!].y = sy;
  }
};

let state: lbfgs.State | undefined = undefined;

const move = (x: number, y: number) => {
  if (selected === undefined) return;
  state = undefined;
  glyphs[selected].x = x * scale;
  glyphs[selected].y = y * scale;
};

const choose = (x: number, y: number) => {
  // set `selected` to the index of the closest glyph to (x, y)
  let min = Infinity;
  let best: number | undefined = undefined;
  for (let i = 0; i < glyphs.length; ++i) {
    const { x: gx, y: gy } = glyphs[i];
    const d = (x * scale - gx) ** 2 + (y * scale - gy) ** 2;
    if (d < min) {
      min = d;
      best = i;
    }
  }
  selected = best;
  move(x, y);
};

canvas.onmousedown = (e: MouseEvent) => {
  if (e.buttons & 1) choose(e.offsetX, e.offsetY);
};
canvas.onmousemove = (e: MouseEvent) => {
  if (e.buttons & 1) move(e.offsetX, e.offsetY);
};

canvas.ontouchstart = (e: TouchEvent) => {
  e.preventDefault();
  const touch = e.touches[0];
  choose(touch.clientX, touch.clientY);
};
canvas.ontouchmove = (e: TouchEvent) => {
  e.preventDefault();
  const touch = e.touches[0];
  move(touch.clientX, touch.clientY);
};

const glyph = (letter: string, color: string, x: number, y: number) => {
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / scale, -1 / scale);
  drawPath((paths as any)[letter]);
  ctx.restore();
  ctx.fill();
};

const frame = () => {
  if (state === undefined) {
    const x = getVarying();
    state = lbfgs.firstStep(cfg, optimizer, x);
    applyVarying(x);
  } else {
    const x = getVarying();
    lbfgs.stepUntil(cfg, optimizer, x, state, () => null);
    applyVarying(x);
  }

  const { width, height } = canvas;
  ctx.resetTransform();
  ctx.clearRect(0, 0, width, height);
  ctx.scale(ratio, ratio);

  for (let i = 0; i < glyphs.length; ++i) {
    const { key, x, y } = glyphs[i];
    glyph(key, selected === i ? "red" : "black", x / scale, y / scale);
  }

  window.requestAnimationFrame(frame);
};
window.requestAnimationFrame(frame);
