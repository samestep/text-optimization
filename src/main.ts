import letters from "./safe.txt?raw";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const setSize = () => {
  const html = document.documentElement;
  canvas.width = html.clientWidth;
  canvas.height = html.clientHeight;
};
setSize();
window.onresize = setSize;

const parseDat = (text: string): [number, number][] =>
  text
    .trimEnd()
    .split("\n")
    .slice(1)
    .map((line) => line.split(" ").map(parseFloat) as [number, number]);

(async () => {
  const polygons = new Map<string, [number, number][]>();
  for (const letter of letters.trimEnd().split("\n")) {
    const text = await (
      await fetch(new URL(`./polygons/${letter}.dat`, import.meta.url))
    ).text();
    polygons.set(letter, parseDat(text));
  }

  const pairs = new Map<string, [number, number][]>();
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
  const draw = () => {
    const alpha = polygons.get("lower_alpha")!;
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.moveTo(...alpha[0]);
    for (const point of alpha.slice(1)) {
      ctx.lineTo(...point);
    }
    ctx.closePath();
    ctx.fill();

    const beta = polygons.get("lower_beta")!;
    ctx.fillStyle = "green";
    ctx.beginPath();
    ctx.moveTo(...beta[0]);
    for (const point of beta.slice(1)) {
      ctx.lineTo(...point);
    }
    ctx.closePath();
    ctx.fill();

    const pair = pairs.get("lower_alpha-lower_beta")!;
    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.moveTo(...pair[0]);
    for (const point of pair.slice(1)) {
      ctx.lineTo(...point);
    }
    ctx.closePath();
    ctx.fill();

    window.requestAnimationFrame(draw);
  };
  window.requestAnimationFrame(draw);
})();
