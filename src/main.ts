import {
  Bool,
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
import letters from "./safe.txt?raw";

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

const ratio = window.devicePixelRatio;

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

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

let selected = "alpha";

window.onkeydown = ({ key }) => {
  if (key === "a") selected = "alpha";
  if (key === "b") selected = "beta";
};

let alphaX = 100;
let alphaY = 200;

let betaX = 200;
let betaY = 200;

const move = (x: number, y: number) => {
  if (selected === "alpha") {
    alphaX = x;
    alphaY = y;
  }
  if (selected === "beta") {
    betaX = x;
    betaY = y;
  }
};

const mouse = (e: MouseEvent) => {
  if (e.buttons & 1) move(e.offsetX, e.offsetY);
};

canvas.onmousedown = mouse;
canvas.onmousemove = mouse;

const touch = (e: TouchEvent) => {
  e.preventDefault();
  const touch = e.touches[0];
  move(touch.clientX, touch.clientY);
};

canvas.ontouchstart = touch;
canvas.ontouchmove = touch;

const polygons = new Map<string, Vec2[]>();
for (const letter of letters.trimEnd().split("\n")) {
  const text = await (
    await fetch(new URL(`./polygons/${letter}.dat`, import.meta.url))
  ).text();
  polygons.set(letter, parseDat(text));
}

const sdfs = new Map<
  string,
  (x: number, y: number) => { d: number; x: number; y: number }
>();
for (const a of ["lower_alpha"]) {
  for (const b of ["lower_beta"]) {
    const text = await (
      await fetch(`/text-optimization/pairs/${a}-${b}.dat`)
    ).text();
    const poly = parseDat(text);

    const R2 = Vec(2, Real);
    const f = fn([R2], Real, (v) => sdPolygon(poly, [v[0], v[1]]));
    const g = fn([Real, Real], { d: Real, x: Real, y: Real }, (x, y) => {
      const { ret, grad } = vjp(f)([x, y]);
      const v = grad(1);
      return { d: ret, x: v[0], y: v[1] };
    });

    sdfs.set(`${a}-${b}`, await compile(g));
  }
}

const ctx = canvas.getContext("2d")!;

const polygon = (points: Vec2[]) => {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) {
    ctx.lineTo(...point);
  }
  ctx.closePath();
};

const scale = 10;

const glyph = (letter: string, color: string, x: number, y: number) => {
  const points = polygons.get(letter)!;
  ctx.fillStyle = color;
  polygon(points.map(([dx, dy]) => [x + dx / scale, y - dy / scale]));
  ctx.fill();
};

const draw = () => {
  const { width, height } = canvas;
  ctx.resetTransform();
  ctx.clearRect(0, 0, width, height);
  ctx.scale(ratio, ratio);

  const {
    d: distance,
    x: gradX,
    y: gradY,
  } = sdfs.get(`lower_alpha-lower_beta`)!(
    (betaX - alphaX) * scale,
    (alphaY - betaY) * scale,
  );

  ctx.fillStyle = "black";
  ctx.font = "50px sans-serif";
  ctx.fillText(`distance: ${distance / scale}`, 10, 50);

  glyph("lower_alpha", selected === "alpha" ? "red" : "black", alphaX, alphaY);
  glyph("lower_beta", selected === "beta" ? "red" : "black", betaX, betaY);

  ctx.strokeStyle = "green";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(alphaX, alphaY);
  ctx.lineTo(alphaX - gradX * 20, alphaY + gradY * 20);
  ctx.stroke();

  ctx.strokeStyle = "green";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(betaX, betaY);
  ctx.lineTo(betaX + gradX * 20, betaY - gradY * 20);
  ctx.stroke();

  window.requestAnimationFrame(draw);
};
window.requestAnimationFrame(draw);
