export type DiffLine = { kind: "same" | "add" | "del"; text: string };

/** Line diff (LCS) for comparing pretty-printed recipe revisions. */
export function diffLines(a: string, b: string): DiffLine[] {
  const x = a.split("\n");
  const y = b.split("\n");
  const n = x.length;
  const m = y.length;
  const w = m + 1;
  // lcs[i * w + j] = length of the LCS of x[i..] and y[j..]
  const lcs = new Uint32Array((n + 1) * w);
  const at = (i: number, j: number) => lcs[i * w + j] ?? 0;
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i * w + j] = x[i] === y[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ kind: "same", text: x[i] ?? "" });
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) out.push({ kind: "del", text: x[i++] ?? "" });
    else out.push({ kind: "add", text: y[j++] ?? "" });
  }
  while (i < n) out.push({ kind: "del", text: x[i++] ?? "" });
  while (j < m) out.push({ kind: "add", text: y[j++] ?? "" });
  return out;
}

/** Collapse unchanged runs to a few lines of context. */
export function withContext(lines: DiffLine[], context = 2): (DiffLine | { kind: "gap"; count: number })[] {
  const keep = lines.map(
    (l, i) =>
      l.kind !== "same" ||
      lines.slice(Math.max(0, i - context), i + context + 1).some((x) => x.kind !== "same"),
  );
  const out: (DiffLine | { kind: "gap"; count: number })[] = [];
  let gap = 0;
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (gap) out.push({ kind: "gap", count: gap });
      gap = 0;
      out.push(l);
    } else gap++;
  });
  if (gap) out.push({ kind: "gap", count: gap });
  return out;
}
