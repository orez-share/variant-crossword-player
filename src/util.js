export const normalizedRegion = ({x, y, x2, y2}) => {
  return {
    minX: Math.min(x, x2),
    maxX: Math.max(x, x2),
    minY: Math.min(y, y2),
    maxY: Math.max(y, y2),
  }
}
