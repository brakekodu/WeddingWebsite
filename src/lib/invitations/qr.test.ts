import { describe, expect, it } from "vitest";
import { createQrMatrix, decodeQr, generateQrSvg, qrMatrixToRgba, QR_QUIET_ZONE } from "./qr";

const URL = "https://example.com/i/Ab3_-Zx9Ab3_-Zx9Ab3_-Zx9";

describe("QR codes", () => {
  it("round-trips: the rendered matrix decodes to the exact URL", () => {
    const matrix = createQrMatrix(URL);
    expect(decodeQr(qrMatrixToRgba(matrix))).toBe(URL);
  });

  it("decodes at the smallest practical raster scale", () => {
    expect(decodeQr(qrMatrixToRgba(createQrMatrix(URL), 2))).toBe(URL);
  });

  it("returns null for an image with no QR code", () => {
    const blank = { data: new Uint8ClampedArray(100 * 100 * 4).fill(255), width: 100, height: 100 };
    expect(decodeQr(blank)).toBeNull();
  });

  it("renders an SVG with a quiet zone and escaped title", () => {
    const matrix = createQrMatrix(URL);
    const svg = generateQrSvg(URL, `Invitation <John & Sarah>`);
    const dim = matrix.size + QR_QUIET_ZONE * 2;
    expect(svg).toContain(`viewBox="0 0 ${dim} ${dim}"`);
    expect(svg).toContain("&#60;John &#38; Sarah&#62;");
    expect(svg).not.toContain("<John");
  });
});
