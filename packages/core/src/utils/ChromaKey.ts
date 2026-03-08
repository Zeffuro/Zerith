/**
 * Removes a solid background color from a texture by making matching pixels transparent.
 * Works on the GPU-side by extracting image data from a canvas.
 */
export function applyChromaKey(
    image: HTMLCanvasElement | HTMLImageElement,
    chromaColor: string,
    tolerance: number = 30
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const [keyR, keyG, keyB] = parseHexColor(chromaColor);

    for (let index = 0; index < data.length; index += 4) {
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        const distribution = Math.hypot(
            (r - keyR),
            (g - keyG),
            (b - keyB)
        );

        if (distribution <= tolerance) {
            data[index + 3] = 0;
        }
    }

    context.putImageData(imageData, 0, 0);
    return canvas;
}

function parseHexColor(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
}