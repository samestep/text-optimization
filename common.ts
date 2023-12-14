export type Segment = [string, ...number[]];

export const strings = new Map<string, string>(
  Object.entries(JSON.parse(await Bun.file("letters.json").text())),
);

// our implementation assumes that the outer boundary of the glyph is connected,
// so here we delete all the letters which violate that assumption
strings.delete("lower_i");
strings.delete("lower_j");
strings.delete("upper_Xi");
