import { otherAxis } from './util';
import { leftOf, upOf, rightOf, downOf } from './directions';

export default class Grid {
  #cluePositions;

  constructor({width, height, grid, solution, clues, lettersPerCell=1}) {
    console.assert(grid == null || grid.length === width * height, "wrong size grid");

    this.width = width;
    this.height = height;
    this.grid = $state(grid);
    this.solution = solution;
    this.lettersPerCell = lettersPerCell;

    // notably we do NOT save the clues themselves: we use them to
    // populate the positions, and then discard them.
    this.#cluePositions = this.#calculateCluePositions(clues);
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

  // TODO: perhaps it's weird that the interface calls this `localCoord`.
  localCoord = ({x, y}) => {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.normalizeCoordFmt({x, y});
  }

  // Accepts {x, y} xor {idx}, and returns all three.
  //
  // Note that `idx` is ONLY valid for use with coordinates within the
  // bounds of the grid.
  normalizeCoordFmt = ({x, y, idx}) => {
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
      while (pos && !this.grid[pos.idx].wall && !cells.has(pos.idx)) {
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
  prevWordFrom = ({number, axis}) => {
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
  nextWordFrom = ({number, axis}) => {
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

  #calculateCluePositions(clues) {
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
      numPosition.set(num, { idx });
      if (acrossNums.has(num)) {
        across.push([num, idx]);
      }
      if (downNums.has(num)) {
        down.push([num, idx]);
      }
    }

    // Sort the clues we've collected.
    // Theoretically they should already be sorted, but looping crosswords
    // in particular can do some wacky stuff sometimes. When the two
    // diverge, we prefer to iterate in clue order rather than
    // grid-layout order.
    const keyFn = (a, b) => a[0] - b[0];
    across.sort(keyFn);
    down.sort(keyFn);

    for (const [pos, [num, _]] of across.entries()) {
      numPosition.get(num).across = pos;
    }
    for (const [pos, [num, _]] of down.entries()) {
      numPosition.get(num).down = pos;
    }

    return {across, down, numPosition};
  }

  cellFilled = (idx) => this.grid[idx].fill.length >= this.lettersPerCell;
}
