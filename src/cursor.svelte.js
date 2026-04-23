import { leftOf, upOf, rightOf, downOf } from './directions';
import { otherAxis } from './util';

const biffLimit = 1000;

export default class Cursor {
  // TODO: maybe these three are a `pos`
  x = $state(0);
  y = $state(0);
  idx = $state(0);
  axis = $state("across");
  line = $derived(this.gridObj.lineAt(this));

  constructor(gridObj) {
    this.gridObj = gridObj;
  }

  #cellFilled = (idx) => this.gridObj.cellFilled(this.idx);

  // Set the position of the cursor.
  //
  // `coord` may be a valid `{idx}`, or _any_ `{x, y}`. That is, the
  // `{x, y}` coordinate pair need not exist within the origin utah
  // (unlike `idx`, which must). The coordinate pair will be translated
  // to the origin utah.
  setSelected = (coord) => {
    coord = coord.idx == null ?
      this.gridObj.localCoord(coord) :
      this.gridObj.normalizeCoordFmt(coord);
    if (!coord) return false;
    let { x, y, idx } = coord;
    if (this.gridObj.grid[idx].wall) return false;

    this.x = x;
    this.y = y;
    this.idx = idx;
    return true;
  }

  // Toggle the axis of this cursor.
  toggleAxis = () => {
    this.axis = otherAxis(this.axis);
  }

  // From the current word (eg 32A), move to the start of the previous word
  // (eg, 31A or perhaps 30A)
  prevWord = () => {
    const [num, idx, axis] = this.gridObj.prevWordFrom({ number: this.line.number, axis: this.axis });
    this.axis = axis;
    this.setSelected({idx});
  }

  // From the current word (eg 32A), move to the start of the next word
  // (eg, 33A or perhaps 34A)
  nextWord = () => {
    const [num, idx, axis] = this.gridObj.nextWordFrom({ number: this.line.number, axis: this.axis });
    this.axis = axis;
    this.setSelected({idx});
  }

  // Move to the next open cell in the current word.
  // Start at the current position: if you hit the end of the line,
  // go back to the front of the line and continue. If you hit your
  // starting position, return false.
  nextOpenCellInWord = () => {
    // XXX: this function is very look-before-you-leap-able.
    // I expect any performance gains we'd get here to be minor
    // to the point of super not worth it (not having to
    // recalculate `line` n times, + any downstream `$derived`s).
    // Calling it out as a possibility anyway.
    const first = this.line.first;
    const start = this.idx;
    do {
      if (!this.#cellFilled()) return true;
      if (!this.moveAhead()) this.setSelected({idx: first});
    } while(start !== this.idx)
    return false;
  }

  // Walk backward wordwise to the next unfilled cell
  backToUnfilled = () => {
    if (this.gridObj.progress.filled) return;
    // go to the next non-full cell in the word
    let oops = 0;
    while (this.#cellFilled()) {
      // note that we still `moveAhead`: we walk forward within a word,
      // even as we walk backward in the grid.
      if (!this.moveAhead()) {
        this.prevWord();
      }
      if (oops++ > biffLimit) throw new Error("you biffed it");
    }
  }

  // Walk forward wordwise to the next unfilled cell
  aheadToUnfilled = () => {
    if (this.gridObj.progress.filled) return;
    // go to the next non-full cell in the word
    let oops = 0;
    while (this.#cellFilled()) {
      if (!this.moveAhead()) {
        this.nextWord();
      }
      if (oops++ > biffLimit) throw new Error("you biffed it");
    }
  }

  // when you click a clue,
  // - it takes you to the next letter to solve in that clue
  //   - unless it's full, in which case you go to the first letter
  // - regardless of if you're already in that clue or not
  focusClue = (axis, number) => {
    const idx = this.gridObj.locationOfNum(number);
    this.axis = axis;
    this.setSelected({idx});
    this.nextOpenCellInWord();
  };

  // Apply `step` fn to the cursor position until you find a nonwall cell,
  // and move the cursor there. Used for the arrow keys.
  #jump = (step) => {
    // XXX: this is weirdly one of the few methods that looks before it leaps.
    // I kind of wish more of them were like this, but a lot of them rely on
    // recalculating `line` ᖍ(∙⟞∙)ᖌ
    let oops = 0;
    let pos = this;
    let cell;
    do {
      pos = step(pos);
      pos = this.gridObj.localCoord(pos);
      if (!pos) return false;
      cell = this.gridObj.grid[pos.idx];
      if (oops++ > biffLimit) throw new Error("you biffed it");
    } while (cell.wall)
    this.setSelected({idx: pos.idx});
  }
  jumpLeft = () => this.#jump(leftOf);
  jumpUp = () => this.#jump(upOf);
  jumpRight = () => this.#jump(rightOf);
  jumpDown = () => this.#jump(downOf);

  // Move the cursor one cell in the given direction, unless this would move
  // the cursor into a wall. Returns `false` in this case, `true` otherwise.
  #move = (step) => this.setSelected(step(this));
  // These methods are private only because they don't currently need to be public.
  // There's no issue with making them public if needed.
  #moveLeft = () => this.#move(leftOf);
  #moveUp = () => this.#move(upOf);
  #moveRight = () => this.#move(rightOf);
  #moveDown = () => this.#move(downOf);

  moveAhead = () => this.axis === "across" ? this.#moveRight() : this.#moveDown();
  moveBack = () => this.axis === "across" ? this.#moveLeft() : this.#moveUp();
}
