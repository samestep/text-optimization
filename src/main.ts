import letters from "./safe.txt?raw";

const clamp = (x: number, min: number, max: number) =>
  Math.max(min, Math.min(max, x));

const all = (xs: boolean[]): boolean => xs.every((x) => x);

const not = (xs: boolean[]): boolean[] => xs.map((x) => !x);

type Vec2 = [number, number];

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];

const mul = (v: Vec2, c: number): Vec2 => [v[0] * c, v[1] * c];

const dot = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];

// https://iquilezles.org/articles/distfunctions2d/
const sdPolygon = (v: Vec2[], p: Vec2) => {
  const N = v.length;
  let d = dot(sub(p, v[0]), sub(p, v[0]));
  let s = 1.0;
  for (let i = 0, j = N - 1; i < N; j = i, i++) {
    const e = sub(v[j], v[i]);
    const w = sub(p, v[i]);
    const b = sub(w, mul(e, clamp(dot(w, e) / dot(e, e), 0.0, 1.0)));
    d = Math.min(d, dot(b, b));
    const c = [p[1] >= v[i][1], p[1] < v[j][1], e[0] * w[1] > e[1] * w[0]];
    if (all(c) || all(not(c))) s *= -1.0;
  }
  return s * Math.sqrt(d);
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

const pairs = new Map<string, Vec2[]>();
for (const a of ["lower_alpha"]) {
  for (const b of ["lower_beta"]) {
    pairs.set(
      `${a}-${b}`,
      parseDat(
        await (await fetch(`/text-optimization/pairs/${a}-${b}.dat`)).text(),
      ),
    );
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

  const distance =
    sdPolygon(pairs.get(`lower_alpha-lower_beta`)!, [
      (betaX - alphaX) * scale,
      (alphaY - betaY) * scale,
    ]) / scale;

  ctx.fillStyle = "black";
  ctx.font = "50px sans-serif";
  ctx.fillText(`distance: ${distance}`, 10, 50);

  glyph("lower_alpha", selected === "alpha" ? "red" : "black", alphaX, alphaY);
  glyph("lower_beta", selected === "beta" ? "red" : "black", betaX, betaY);

  window.requestAnimationFrame(draw);
};
window.requestAnimationFrame(draw);
