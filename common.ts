export type Segment = [string, ...number[]];

export const strings = new Map<string, string>(
  Object.entries(JSON.parse(await Bun.file("letters.json").text())),
);
