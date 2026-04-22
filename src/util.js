export const gcd = (a, b) => {
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

export const mod = (n, d) => ((n % d) + d) % d;

export const otherAxis = (axis) => axis === "across" ? "down" : "across";
