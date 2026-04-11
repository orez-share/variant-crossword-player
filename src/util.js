export const normalizedRegion = ({x, y, x2, y2}) => {
  return {
    minX: Math.min(x, x2),
    maxX: Math.max(x, x2),
    minY: Math.min(y, y2),
    maxY: Math.max(y, y2),
  }
}

export const gcd = (a, b) => {
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

export const mod = (n, d) => ((n % d) + d) % d;
