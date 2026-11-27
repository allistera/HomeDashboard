import type { HueSaturation } from "@/models/rooms";

export function rgbHex(red: number, green: number, blue: number): string {
  const hex = [red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex.toUpperCase()}`;
}

export function hueSaturationHex([hue, saturation]: HueSaturation): string {
  // Convert HSV at full value. The light's brightness is controlled separately.
  const channel = (offset: number) => {
    const position = (offset + hue / 60) % 6;
    return 255 * (1 - (saturation / 100) * Math.max(0, Math.min(position, 4 - position, 1)));
  };
  return rgbHex(channel(5), channel(3), channel(1));
}

export function rgbHueSaturation(red: number, green: number, blue: number): HueSaturation {
  const max = Math.max(red, green, blue);
  const chroma = max - Math.min(red, green, blue);
  if (chroma === 0) return [0, 0];

  let sector;
  if (max === red) sector = (green - blue) / chroma;
  else if (max === green) sector = 2 + (blue - red) / chroma;
  else sector = 4 + (red - green) / chroma;
  return [(sector * 60 + 360) % 360, (chroma / max) * 100];
}
