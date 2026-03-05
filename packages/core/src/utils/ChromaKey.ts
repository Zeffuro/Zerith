/**
 * Removes a solid background color from a texture by making matching pixels transparent.
 * Works on the GPU-side by extracting image data from a canvas.
 */
export function applyChromaKey(
    image: HTMLImageElement | HTMLCanvasElement,
    chromaColor: string,
    tolerance: number = 30
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const [keyR, keyG, keyB] = parseHexColor(chromaColor);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const dist = Math.sqrt(
            (r - keyR) ** 2 +
            (g - keyG) ** 2 +
            (b - keyB) ** 2
        );

        if (dist <= tolerance) {
            data[i + 3] = 0;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function parseHexColor(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return [r, g, b];
}