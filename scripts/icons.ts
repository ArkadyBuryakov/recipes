// Regenerates PNG app icons from public/icon.svg: bun scripts/icons.ts
import sharp from "sharp";

for (const size of [192, 512])
  await sharp("public/icon.svg", { density: 300 }).resize(size, size).png().toFile(`public/icon-${size}.png`);
