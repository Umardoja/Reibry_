// Rasterize the existing approved REIBRY SVG; this does not introduce a new identity.
import sharp from "sharp";
import { readFile } from "node:fs/promises";
const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
for (const size of [192, 512]) await sharp(svg).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
const safe = await sharp(svg).resize(320, 320).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0F6B5C" } }).composite([{ input: safe, gravity: "centre" }]).png().toFile("public/icons/maskable-512.png");
const badge = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><text x="48" y="76" text-anchor="middle" font-family="Arial" font-size="80" font-weight="bold" fill="white">R</text></svg>');
await sharp(badge).png().toFile("public/icons/badge-96.png");
