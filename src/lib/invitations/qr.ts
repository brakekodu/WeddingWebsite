/**
 * QR generation and decoding.
 *
 * One QR matrix is the single source for both the SVG we display and print
 * and the raster we decode during validation, so validation proves the exact
 * modules that get printed. Pure JavaScript: no native canvas dependency.
 */
import jsQR from "jsqr";
import QRCode from "qrcode";

/** Medium error correction (~15%) keeps codes small yet tolerant of print wear. */
export const QR_ERROR_CORRECTION = "M" as const;
/** Quiet zone in modules; the QR spec requires at least 4. */
export const QR_QUIET_ZONE = 4;

export interface QrMatrix {
  size: number;
  version: number;
  isDark(row: number, col: number): boolean;
}

export function createQrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: QR_ERROR_CORRECTION });
  const { size } = qr.modules;
  return {
    size,
    version: qr.version,
    isDark: (row, col) => Boolean(qr.modules.get(row, col)),
  };
}

/**
 * Renders a crisp, resolution-independent SVG. Dark modules are merged into a
 * single path. The SVG scales to its container; set width/height via CSS.
 */
export function qrMatrixToSvg(matrix: QrMatrix, options: { title?: string } = {}): string {
  const dim = matrix.size + QR_QUIET_ZONE * 2;
  let path = "";
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.isDark(row, col)) {
        path += `M${col + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h1v1h-1z`;
      }
    }
  }
  const title = options.title ? `<title>${escapeXml(options.title)}</title>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" ` +
    `shape-rendering="crispEdges" role="img">${title}` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<path fill="#000000" d="${path}"/></svg>`
  );
}

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Rasterizes the matrix (including quiet zone) to RGBA pixels for decoding. */
export function qrMatrixToRgba(matrix: QrMatrix, pixelsPerModule = 4): RgbaImage {
  const dimModules = matrix.size + QR_QUIET_ZONE * 2;
  const width = dimModules * pixelsPerModule;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.isDark(row, col)) continue;
      const x0 = (col + QR_QUIET_ZONE) * pixelsPerModule;
      const y0 = (row + QR_QUIET_ZONE) * pixelsPerModule;
      for (let y = y0; y < y0 + pixelsPerModule; y++) {
        for (let x = x0; x < x0 + pixelsPerModule; x++) {
          const i = (y * width + x) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width, height: width };
}

/** Decodes a QR code from RGBA pixels. Returns null when nothing decodes. */
export function decodeQr(image: RgbaImage): string | null {
  const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
  return result?.data ?? null;
}

export function generateQrSvg(text: string, title?: string): string {
  return qrMatrixToSvg(createQrMatrix(text), { title });
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
