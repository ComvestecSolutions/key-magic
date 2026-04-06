import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webPublicDir = path.resolve(__dirname, "..", "public");
const serviceAssetsDir = path.resolve(__dirname, "..", "..", "KeyMagic.Service", "Assets");

const sourceSvgPath = path.join(webPublicDir, "favicon.svg");
const webPngPath = path.join(webPublicDir, "keymagic-icon.png");
const webIcoPath = path.join(webPublicDir, "keymagic.ico");
const serviceIcoPath = path.join(serviceAssetsDir, "KeyMagic.ico");

const iconPngSize = 512;
const icoSizes = [16, 24, 32, 40, 48, 64, 128, 256];

function renderPng(svgBuffer, size) {
  const resvg = new Resvg(svgBuffer, {
    background: "rgba(0, 0, 0, 0)",
    fitTo: {
      mode: "width",
      value: size,
    },
  });

  return resvg.render().asPng();
}

async function main() {
  const svgBuffer = await readFile(sourceSvgPath);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "keymagic-icons-"));

  try {
    await mkdir(serviceAssetsDir, { recursive: true });

    const icoSourcePaths = [];

    for (const size of icoSizes) {
      const pngPath = path.join(tempDir, `keymagic-${size}.png`);
      await writeFile(pngPath, renderPng(svgBuffer, size));
      icoSourcePaths.push(pngPath);
    }

    const [pngBuffer, icoBuffer] = await Promise.all([
      renderPng(svgBuffer, iconPngSize),
      pngToIco(icoSourcePaths),
    ]);

    await Promise.all([
      writeFile(webPngPath, pngBuffer),
      writeFile(webIcoPath, icoBuffer),
      writeFile(serviceIcoPath, icoBuffer),
    ]);

    console.info(`Generated ${path.basename(webPngPath)} and multi-size ICO assets from ${path.basename(sourceSvgPath)}.`);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});