// Module for the `Grid` class
import { gcd, mod, otherAxis } from './util';
import { leftOf, upOf, rightOf, downOf } from './directions';

// ===

const tessellationOriginRow = ({aw, ah, b, c, lx}) => {
  const row = [];
  let ux = 0;
  let uy = 0;
  let uw = aw + b;
  for (let x = 0; x < lx; x++) {
    if (ux >= uw) { // end of shape
      ux = 0;
      uy += c;
      if (uy >= ah + c) { // start on the next row of utahs
        uy -= ah + c;
      }
      const inC = uy >= ah;
      uw = inC ? aw : aw + b // recalc uw
    }
    row.push({x: ux, y: uy});
    ux += 1;
  }
  return row;
}

// These constants work to find the smallest width after which the
// tessellation loops.
//   ie: starting from the top-left corner, how far in the `x` axis
//   you have to move to hit another top-left corner.
// - `txl` is the number of long segments in a loop-width
// - `txs` is the number of short segments in a loop-width
// - `dx` is used in a couple places, surprisingly.
//   - In these constants, it's used to recognize when we loop earlier
//     than expected (because we exactly fit multiple loops in a
//     "single loop").
//   - Weirdly, `dx` is also the number of identical consecutive rows.
//     All of our rows are the same shape, modulo some offset. But
//     eg: if `dx = 3`, then the first three rows are the _exact_ same,
//     including the offset. The next three rows are also identical to
//     each other, and so on.
//     - This means when we search for the `step` goal, we need to look
//       for the height we're actually gonna hit: `dx`
//     - And also when we're actually applying the steps, we only want to
//       perform a "step" every `dx` rows.
// - `lx` is the loop-width itself. It's the number of long segments times
//   their width, plus the number of short segments times their width.
const loopConstants = ({mainMajor, mainMinor, offMajor, offMinor}) => {
  const mainFull = mainMajor + mainMinor;
  if (offMinor === 0) {
    // When the off-axis has no variation then we're dealing with a
    // full rectangular grid (not a utah). We're able to pack these
    // rectangles into a more traditional grid shape. In some ways this
    // simplifies our math, but it also means our utah math breaks down,
    // so we need to special-case it.
    // `lx` - We loop as quickly as possible: one trip across the rectangle
    //        through the main axis.
    // `dx` - _All_ of the lines in the rectangle are the exact same.
    return [mainFull, offMajor];
  }
  const dx = gcd(offMajor, offMinor);
  const txl = offMajor / dx;
  const txs = offMinor / dx;
  const lx = txl * mainFull + txs * mainMajor;
  return [lx, dx];
}

const tessellationConstants = ({width, height, tessellation}) => {
  const {x, y} = tessellation;
  console.assert(0 <= x < width, `tessellation.x = ${x}`);
  console.assert(0 <= y < height, `tessellation.y = ${y}`);

  const aw = width - x;
  const ah = height - y;
  const b = x;
  const c = y;

  const [lx, dx] = loopConstants({
    mainMajor: aw,
    mainMinor: b,
    offMajor: ah,
    offMinor: c,
  });

  // The process for finding the loop-height is the same, but with the
  // axis of all the variables swapped.
  // Unlike in the loop-width constants, we don't end up reusing `dy`.
  const [ly, _] = loopConstants({
    mainMajor: ah,
    mainMinor: c,
    offMajor: aw,
    offMinor: b,
  });

  const originRow = tessellationOriginRow({aw, ah, b, c, lx});
  const step = c == 0 ? b : originRow.findIndex(({y}) => y == dx);
  return {
    originRow,
    gridLoop: {x: lx, y: ly},
    step,
    dx,
  };
}

// ===

export default class Grid {
  #tessel;
  #cluePositions;

  constructor({width, height, grid, solution, tessellation, clues, lettersPerCell=1}) {
    console.assert(grid == null || grid.length === width * height, "wrong size grid");
    this.width = width;
    this.height = height;
    this.lettersPerCell = lettersPerCell;

    // blank out cells within the `tessellation` chunked-out area
    for (let y = tessellation.y; y > 0; y--) {
      for (let x = tessellation.x; x > 0; x--) {
        const idx = (height - y) * width + (width - x);
        grid[idx] = null;
        solution[idx] = null;
      }
    }
    this.grid = $state(grid);
    this.solution = solution;

    this.tessellation = tessellation;
    this.#tessel = tessellationConstants({width, height, tessellation});

    // notably we do NOT save the clues themselves: we use them to
    // populate the positions, and then discard them.
    this.#cluePositions = this.calculateCluePositions(clues);
  }

  // XXX: we could be trickier with this: careful tracking of how many
  // cells are filled/solved, then maintaining those values when we
  // update a cell, for O(1) calculation of these values.
  // That sounds terrible and brittle though. O(n) should be fine,
  // esp with svelte's caching.
  progress = $derived.by(() => {
    let filled = true;
    let solved = true;
    const top = this.width * this.height;
    for (let idx = 0; idx < top; idx++) {
      const cell = this.grid[idx];
      if (!cell || cell.wall) continue;
      if (!this.cellFilled(idx)) filled = false;
      if (cell.fill !== this.solution[idx]) solved = false;
    }
    return {filled, solved};
  });

  // Translate a global position `{x, y}` to a local position within the
  // "origin utah". Returns `{x, y, idx}`: note that the concept of `idx`
  // is only meaningful in local coordinates.
  //
  // Since our grid is tessellated, walking off the edge of the grid
  // takes us to another point on the grid. Indeed: walking a whole lot
  // will only ever take us to some point on the grid. This function
  // can translate the displacement coordinates of such a long walk into
  // local coordinates in constant time.
  localCoord({x, y}) {
    const { gridLoop, step, dx, originRow } = this.#tessel;
    x = mod(x, gridLoop.x);
    y = mod(y, gridLoop.y);
    // Every chunk of `dx` rows are identical to each other.
    // We only `step` when we reach a new offset of row.
    const idx = Math.floor(y / dx) * step + x;
    const coord = {...originRow[mod(idx, gridLoop.x)]};
    coord.y += mod(y, dx);
    return this.normalizeCoordFmt(coord);
  }

  // Accepts {x, y} xor {idx}, and returns all three.
  //
  // Note that `idx` is ONLY valid for use with coordinates within the
  // bounds of the local utah.
  normalizeCoordFmt({x, y, idx}) {
    const hasX = x != null;
    const hasY = y != null;
    const hasIdx = idx != null;
    if (hasX && hasY && !hasIdx) {
      return {x, y, idx: y * this.width + x};
    }
    if (!hasX && !hasY && hasIdx) {
      return {
        x: idx % this.width,
        y: Math.floor(idx / this.width),
        idx,
      }
    }
    throw new Error("expected {x, y} xor {idx}");
  }

  // Collect information about the line referenced by the `Cursor`.
  lineAt({idx, axis}) {
    const cells = new Set;
    const forward = axis === "across" ? rightOf : downOf;
    const backward = axis === "across" ? leftOf : upOf;
    // XXX: If (if!) we trust that we're receiving a `Cursor`, we can skip
    // this normalization and just trust `const init = { x, y, idx };`.
    //
    // I've spent too many brain cycles considering which is better, and
    // it so so doesn't matter.
    const init = this.normalizeCoordFmt({ idx });

    // &mut cells, &this
    const collect = (init, walk) => {
      let pos = init;
      let last = init;
      // TODO: if we want to support non-tessellated xwords
      // we gotta (conditionally) count edges as walls as well.
      // TODO: ..what the hell `number` does a fully-looping clue have?
      //  How do we _tell_?
      // Do we.. take ALL the numbers? Is this another fun gimmick??
      while (!this.grid[pos.idx].wall && !cells.has(pos.idx)) {
        cells.add(pos.idx);
        last = pos;
        pos = walk(pos);
        pos = this.localCoord(pos);
      }
      return last.idx;
    }

    const first = collect(init, backward);
    const number = this.grid[first].number;
    cells.delete(init.idx);
    const last = collect(init, forward);

    return { cells, number, first, last }
  }

  // Get the [number, idx, axis] of the "previous" clue from the given clue.
  // The "previous" clue is the one numerically before the given clue,
  // or the last clue on the opposite axis if we're at the first clue on
  // our axis.
  prevWordFrom({number, axis}) {
    const clues = this.#cluePositions[axis];
    let clueIdx = this.#cluePositions.numPosition.get(number)?.[axis];
    if (clueIdx == null) throw new Error(`missing #${number}`);
    clueIdx -= 1;
    if (clueIdx >= 0) return [...clues[clueIdx], axis];
    const offxis = otherAxis(axis);
    const offClues = this.#cluePositions[offxis];
    const last = offClues.length - 1;
    return [...offClues[last], offxis];
  }

  // Get the [number, idx, axis] of the "next" clue from the given clue.
  // The "next" clue is the one following numerically from the given clue,
  // or the first clue on the opposite axis if we're at the last clue on
  // our axis.
  nextWordFrom({number, axis}) {
    const clues = this.#cluePositions[axis];
    let clueIdx = this.#cluePositions.numPosition.get(number)?.[axis];
    if (clueIdx == null) throw new Error(`missing #${number}`);
    clueIdx += 1;
    if (clueIdx < clues.length) return [...clues[clueIdx], axis];
    const offxis = otherAxis(axis);
    const offClues = this.#cluePositions[offxis];
    return [...offClues[0], offxis];
  }

  // Get the `idx` of the cell labeled `num`.
  locationOfNum = (num) => this.#cluePositions.numPosition.get(num)?.idx;

  calculateCluePositions(clues) {
    const collectClueNums = (clues) => {
      const nums = new Set;
      for (const [num, _] of clues) {
        if (nums.has(num)) {
          console.warn(`clues contain duplicate number ${num}.`);
          console.warn("This isn't supported, and will likely lead to unpredictable behavior!");
          return;
        }
        nums.add(num);
      }
      return nums;
    }
    const acrossNums = collectClueNums(clues.across);
    const downNums = collectClueNums(clues.down);

    const across = [];
    const down = [];
    const numPosition = new Map;

    for (const [idx, cell] of this.grid.entries()) {
      if (!cell || cell.wall) continue;
      const num = cell.number;
      if (num == null) continue;
      if (numPosition.has(num)) {
        console.warn(`grid contains duplicate number ${num}.`);
        console.warn("This isn't supported, and will likely lead to unpredictable behavior!");
      }
      const position = { idx };
      if (acrossNums.has(num)) {
        position.across = across.length;
        across.push([num, idx]);
      }
      if (downNums.has(num)) {
        position.down = down.length;
        down.push([num, idx]);
      }
      numPosition.set(num, position);
    }

    return {across, down, numPosition};
  }

  cellFilled = (idx) => this.grid[idx].fill.length >= this.lettersPerCell;
}
