// Module for the `Grid` class
import { normalizedRegion } from './util';

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

export default class Grid {
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
      const {x, y} = tessellation;
      console.assert(0 <= x < width, `tessellation.x = ${x}`);
      console.assert(0 <= y < height, `tessellation.y = ${y}`);
      // Mark some cells as Redirects.
      // Specifically the x by y cells in the bottom right corner
      const tesselX = width - x;
      const tesselY = height - y; // I think Odysseus visited tesselY
      for (let oy = 0; oy < y; oy++) {
        for (let ox = 0; ox < x; ox++) {
          let redirect = oy * width + ox;
          const reredirect = this.grid[redirect].redirect;
          redirect = reredirect != null ? reredirect : redirect;
          const idx = (oy + tesselY) * width + (ox + tesselX);
          this.grid[idx] = { redirect };
        }
      }
    }
    this.tessellation = tessellation;
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

  // normalizeTessellatedCoord({x, y, idx}) {
  //   // I _believe_ this is a similar problem to a hex grid.
  //   // https://www.redblobgames.com/grids/hexagons/#pixel-to-hex

  //   // Grids are tessellated like Utah:
  //   // AAAABB
  //   // AAAABB
  //   // AAAABB
  //   // CCCC..

  //   // x = q * AB.width + r * A.width
  //   // y = q * -C.height + r * A.height
  //   //
  //   // soo,
  //   //   M = [[AB.width, A.width], [-C.height, A.height]] * [[q], [r]]
  //   //   [[a, b], [c, d]]⁻¹ = (1/ad-bc)[[d, -b], [-c, a]]
  //   //   M⁻¹ = (1/(AB.width * A.height - A.width * -C.height)) *
  //   //         [[A.height, -A.width], [C.height, AB.width]]
  //   // ... this doesn't really simplify.
  //   const abw = this.width;
  //   const aw = this.width - this.tessellation.x;
  //   const ch = -this.tessellation.y;
  //   const ah = this.height - this.tessellation.y;
  //   const inv = (abw * ah - aw * ch);
  //   // const qf = x * (ah / inv) + y * (-aw / inv);
  //   // const rf = x * (-ch / inv) + y * (abw / inv);
  //   const qf = (ah * x - aw * y) / inv;
  //   const rf = (ch * x - abw * y) / -inv;
  //   const sf = -qf - rf;
  //   const {q, r, s} = cubeRound({qf, rf, sf});
  //   console.log("\nin", {x, y}, "=>", {qf, rf, sf}, {q, r, s});

  //   const ox = x - (q * abw + r * aw);
  //   const oy = y - (q * ch + r * ah);
  //   const oidx = oy * this.height + ox;
  //   const out = {x: ox, y: oy, idx: oidx};
  //   console.log("out:", out);
  //   return out
  // }


  // Accepts {x, y} xor {idx}, and returns all three.
  normalizeCoordFmt({x, y, idx}) {
    const hasX = x != null;
    const hasY = y != null;
    const hasIdx = idx != null;
    if (hasX && hasY && !hasIdx) {
      return {x, y, idx: y * this.width + x};
    }
    if (!hasX && !hasY && hasIdx) {
      // TODO: negatives
      return {
        x: idx % this.width,
        y: Math.floor(idx / this.width),
        idx,
      }
    }
    throw new Error("expected {x, y} xor {idx}");
  }

  // TODO: would be nice if we could just update the global coordinate,
  // and then translate that back into the Origin Utah.

  leftOf({x, y}) {
    if (x > 0) {
      // no loop
      return {x: x - 1, y};
    } else if (y < this.tessellation.y) {
      // loop into C
      return {
        x: this.innerWidth-1,
        y: this.innerHeight + y,
      };
    } else {
      // loop into B
      return {
        x: this.width - 1,
        y: y - this.tessellation.y,
      };
    }
  }

  rightOf({x, y}) {
    if (x == this.innerWidth-1 && y >= this.innerHeight) {
      // loop from C
      return {x: 0, y: y - this.innerHeight};
    } else if (x < this.width-1) {
      return {x: x + 1, y};
    } else {
      // loop from B
      return {x: 0, y: y + this.tessellation.y};
    }
  }

  upOf({x, y}) {
    if (y > 0) {
      return {x, y: y - 1};
    } else if (x < this.tessellation.x) {
      // loop into B
      return {
        x: x + this.innerWidth,
        y: this.innerHeight-1,
      };
    } else {
      // loop into C
      return {
        x: x - this.tessellation.x,
        y: this.height - 1,
      };
    }
  }

  downOf({x, y}) {
    if (y == this.innerHeight-1 && x >= this.innerWidth) {
      // loop from B
      return {x: x - this.innerWidth, y: 0};
    } else if (y < this.height-1) {
      return {x, y: y + 1};
    } else {
      // loop from C
      return {x: x + this.tessellation.x, y: 0};
    }
  }

  lineAt({x, y, axis}) {
    const cells = new Set;
    const forward = axis === "across" ? this.rightOf : this.downOf;
    const backward = axis === "across" ? this.leftOf : this.upOf;
    const init = { x, y, idx: y * this.width + x };

    // &mut cells, &this
    const collect = (init, walk) => {
      let pos = init;
      while (!this.grid[pos.idx].wall && !cells.has(pos.idx)) {
        cells.add(pos.idx);
        pos = walk(pos);
        pos.idx = pos.y * this.width + pos.x;
        // console.log(this.grid[pos.idx]);
      }
    }

    collect(init, backward.bind(this));
    cells.delete(init.idx);
    collect(init, forward.bind(this));

    return { cells }
  }

  // at(idx) {
  //   // TODO: normalizeTessellatedCoord
  //   console.assert(0 <= idx && idx < this.width * this.height, `out of bounds lookup: ${idx}`);
  //   const cell = this.grid[idx];
  //   if (cell.redirect == null) return cell;
  //   return this.grid[cell.redirect];
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

// // https://www.redblobgames.com/grids/hexagons/#rounding
// // I have no idea if this is a valid thing to do to _our_ coordinate system.
// const cubeRound = ({qf, rf, sf}) => {
//   let q = Math.round(qf);
//   let r = Math.round(rf);
//   let s = Math.round(sf);

//   const qDiff = Math.abs(q - qf);
//   const rDiff = Math.abs(r - rf);
//   const sDiff = Math.abs(s - sf);

//   if (qDiff > rDiff && qDiff > sDiff) {
//     q = -r-s;
//   } else if (rDiff > sDiff) {
//     r = -q-s
//   } else {
//     s = -q-r
//   }
//   return { q, r, s }
// }
