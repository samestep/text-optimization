const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const setSize = () => {
  const html = document.documentElement;
  canvas.width = html.clientWidth;
  canvas.height = html.clientHeight;
};
setSize();
window.onresize = setSize;

const ctx = canvas.getContext("2d")!;
const draw = () => {
  const { width, height } = canvas;

  ctx.strokeStyle = "red";
  ctx.strokeRect(5, 5, width - 10, height - 10);

  window.requestAnimationFrame(draw);
};
window.requestAnimationFrame(draw);
