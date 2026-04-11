// Module for the `Grid` class
import { normalizedRegion, gcd, mod } from './util';
import { leftOf, upOf, rightOf, downOf } from './directions';

// silly overkill decorators for fns which step through
// the grid either Down or Across.
// The decorated function should be generic over, and accept,:
// - `x` and `y`, some starting position
// - `front`, representing the index of the start of the axis (inclusive)
// - `back`, representing the index past the end of the axis (exclusive)
// - `step`, the amount to step the index by

const downStep = function(fn) {
  return function({x, y, ...kwargs}) {
    console.assert(this instanceof Grid, "`this` bound wrong");
    return fn.call(this, {
      x, y, ...kwargs,
      front: 0,
      back: this.grid.length,
      step: this.width,
    });
  }
};

const acrossStep = function(fn) {
  return function({x, y, ...kwargs}) {
    console.assert(this instanceof Grid, "`this` bound wrong");
    const row = y * this.width;
    return fn.call(this, {
      x, y, ...kwargs,
      front: row,
      back: row + this.width,
      step: 1,
    });
  }
}

// ===
// fn for fetching the "fill pattern" around some coordinate.
// A "pattern" (: [String]) is the cell fill before and after
// the coordinate in the given axis, from wall to wall.

const snagPattern = function({front, back, step, x, y, x2, y2}) {
  // I wrote this function bad, as a joke.
  const { grid, width } = this;
  const ERROR = null;
  let chunkIndex = -1;
  let idx = y * width + x;
  if (grid[idx].wall) return ERROR; // XXX
  // run backwards
  for(; idx >= front; idx -= step) {
    if (grid[idx].wall) break;
    chunkIndex++;
  }
  const region = normalizedRegion({x, y, x2, y2});
  const selIdx = {
    start: region.minY * width + region.minX,
    end: region.maxY * width + region.maxX,
  };
  const sel = { start: null, end: null };
  const start = idx + step;
  let gridChunks = [];
  // run forward and collect chunks
  for (idx = start; idx < back && !grid[idx].wall; idx += step) {
    if (idx == selIdx.start) sel.start = gridChunks.length;
    else if (idx == selIdx.end) sel.end = gridChunks.length;
    gridChunks.push(grid[idx].fill);
  }

  // If we're selecting a single line of cells which falls entirely within
  // the pattern we're snagging, force the suggestions to completely
  // fill the selection.
  //
  // Understanding how these requirements are represented by this condition
  // is left as an exercise to the reader (sorry).
  let exact = false;
  if (sel.start != null && sel.end != null) {
    gridChunks = gridChunks.slice(sel.start, sel.end + 1);
    chunkIndex -= sel.start;
    exact = true;
  }
  return { pattern: gridChunks, index: chunkIndex, exact };
}

// ===

const frontClueCell = function({front, step, x, y}) {
  const { grid, width } = this;
  // unselected value is an empty object
  // because it simplifies the svelte binds
  if (x == null || y == null) return {};
  let idx = x + width * y;
  if (!grid[idx]) return {};

  // Step backward into the leading wall, or out of bounds.
  for (; idx >= front && !grid[idx].wall; idx -= step) { }

  // Step forward again to get leading space
  return grid[idx + step] || {};
};

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

const tessellationConstants = ({width, height, tessellation}) => {
  const {x, y} = tessellation;
  console.assert(0 <= x < width, `tessellation.x = ${x}`);
  console.assert(0 <= y < height, `tessellation.y = ${y}`);

  const aw = width - x;
  const ah = height - y;
  const b = x;
  const c = y;

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
  const dx = gcd(ah, c);
  const txl = ah / dx;
  const txs = c / dx;
  const lx = txl * (aw + b) + txs * aw;

  // The process for finding the loop-height is the same, but with the
  // axis of all the variables swapped.
  // Unlike in the loop-width constants, we don't end up reusing `dy`.
  const dy = gcd(aw, b);
  const tyl = aw / dy;
  const tys = b / dy;
  const ly = tyl * (ah + c) + tys * ah;

  const originRow = tessellationOriginRow({aw, ah, b, c, lx});
  const step = originRow.findIndex(({y}) => y == dx);
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

  constructor({width, height, grid, tessellation}) {
    console.assert(grid == null || grid.length === width * height, "wrong size grid");
    this.width = width;
    this.height = height;
    this.grid = grid ?? Array(width * height).fill(null)
      .map(() => ({
        wall: false,
        fill: "",
        number: null,
        downClue: null,
        acrossClue: null,
      }));

    if (tessellation) {
      this.tessellation = tessellation;
      this.#tessel = tessellationConstants({width, height, tessellation});
    }
    this.renumber();
  }

  get innerWidth() {
    return this.width - this.tessellation.x;
  }

  get innerHeight() {
    return this.height - this.tessellation.y;
  }

  acrossStep(fn) { return acrossStep(fn) }
  downStep(fn) { return downStep(fn) }

  acrossPattern = acrossStep(snagPattern);
  downPattern = downStep(snagPattern);

  acrossClueCell = acrossStep(frontClueCell);
  downClueCell = downStep(frontClueCell);

  // XXX: Takes ownership of `sub`.
  updatesForBlitSubgrid(sub, {offX, offY}) {
    // TODO: some visual feedback if this fails
    if (offX + sub.width > this.width || offY + sub.height > this.height) return;
    const updates = [];
    let gridIdx = 0;
    for (let y = 0; y < sub.height; y++) {
      for (let x = 0; x < sub.width; x++) {
        const idx = (offY + y) * this.width + (offX + x);
        updates.push({
          idx,
          is: sub.grid[gridIdx],
        });
        gridIdx++;
      }
    }
    return updates;
  }

  // Passing `idx` ONLY for use with coordinates within the bounds of a local utah
  // XXX: this is a weird precondition but I _am_ relying on it currently.
  //   Consider how to restructure this to be less weird.
  localCoord(global_) {
    let { x, y } = this.normalizeCoordFmt(global_);
    const { gridLoop, step, dx } = this.#tessel;
    x = mod(x, gridLoop.x);
    y = mod(y, gridLoop.y);
    // Every chunk of `dx` rows are identical to each other.
    // We only `step` when we reach a new offset of row.
    const idx = Math.floor(y / dx) * step + x;
    const coord = this.#tessel.originRow[mod(idx, gridLoop.x)];
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

  lineAt({x, y, axis}) {
    const cells = new Set;
    const forward = axis === "across" ? rightOf : downOf;
    const backward = axis === "across" ? leftOf : upOf;
    const init = this.localCoord({ x, y });

    // &mut cells, &this
    const collect = (init, walk) => {
      let pos = init;
      while (!this.grid[pos.idx].wall && !cells.has(pos.idx)) {
        cells.add(pos.idx);
        pos = walk(pos);
        pos = this.localCoord(pos);
      }
    }

    collect(init, backward);
    cells.delete(init.idx);
    collect(init, forward);

    return { cells }
  }

  // at(pos) {
  //   const { idx } = this.localCoord(pos);
  //   return this.grid[idx];
  // }

  clone() {
    const grid = [];
    for (const elem of this.grid) {
      grid.push({...elem});
    }
    return new Grid({
      grid,
      height: this.height,
      width: this.width,
    });
  }

  // Clone a region of the grid.
  cloneSubgrid({minX, minY, maxX, maxY}) {
    const grid = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * this.width + x;
        grid.push({...this.grid[idx]});
      }
    }
    return new Grid({
      grid,
      height: maxY - minY + 1,
      width: maxX - minX + 1,
    });
  }

  renumber() {
    const { grid, width, height } = this;
    let num = 1;
    const setNum = ({idx, topBounded, leftBounded}) => {
      const cell = grid[idx];
      const bounded = topBounded || leftBounded;
      cell.number = null;
      if (cell.wall) {
        cell.downClue = null;
        cell.acrossClue = null;
        return;
      }
      if (topBounded) cell.downClue ??= "";
      else cell.downClue = null;
      if (leftBounded) cell.acrossClue ??= "";
      else cell.acrossClue = null;
      if (!cell.wall && bounded) {
        cell.number = num;
        num++;
      }
    };

    const isWall = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return true;
      const idx = y * width + x;
      return grid[idx].wall;
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        // one cell regions do NOT get clues.
        const topBounded = isWall(x, y-1) && !isWall(x, y+1);
        const leftBounded = isWall(x-1, y) && !isWall(x+1, y);
        setNum({idx, topBounded, leftBounded});
      }
    }
  }
}
