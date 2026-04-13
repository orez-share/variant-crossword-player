import { leftOf, upOf, rightOf, downOf } from './directions';

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
    const { gridObj } = this;
    let { x, y, idx } = gridObj.localCoord(coord);
    if (gridObj.grid[idx].wall) return false;

    this.x = x;
    this.y = y;
    this.idx = idx;
    return true;
  }

  // Toggle the axis of this cursor.
  toggleAxis = () => {
    this.axis = this.axis === "across" ? "down" : "across";
  }

  // From the current word (eg 32A), move to the start of the previous word
  // (eg, 31A or perhaps 30A)
  prevWord = () => {
    const [num, idx] = this.gridObj.prevWordFrom({ number: this.line.number, axis: this.axis });
    this.setSelected({idx});
  }

  // From the current word (eg 32A), move to the start of the next word
  // (eg, 33A or perhaps 34A)
  nextWord = () => {
    const [num, idx] = this.gridObj.nextWordFrom({ number: this.line.number, axis: this.axis });
    this.setSelected({idx});
  }

  // Find the next open cell in the current word.
  // Start at the current position: if you hit the end of the line,
  // go back to the front of the line and continue. If you hit your
  // starting position, return false.
  nextOpenCellInWord = () => {
    const first = this.line.first;
    const start = this.idx;
    do {
      if (!this.#cellFilled()) return true;
      if (!this.moveAhead()) this.setSelected({idx: first});
    } while(start !== this.idx)
    return false;
  }

  backToUnfilled = () => {
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

  aheadToUnfilled = () => {
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
  jump = (step) => {
    let oops = 0;
    let pos = this;
    let cell;
    do {
      pos = step(pos);
      pos = this.gridObj.localCoord(pos);
      cell = this.gridObj.grid[pos.idx];
      if (oops++ > biffLimit) throw new Error("you biffed it");
    } while (cell.wall)
    this.setSelected({idx: pos.idx});
  }

  // Move the cursor one step in the given direction, unless this would move
  // the cursor into a wall. Returns `false` in this case, `true` otherwise.
  moveLeft = () => this.setSelected(leftOf(this));
  moveUp = () => this.setSelected(upOf(this));
  moveRight = () => this.setSelected(rightOf(this));
  moveDown = () => this.setSelected(downOf(this));

  moveAhead = () => this.axis === "across" ? this.moveRight() : this.moveDown();
  moveBack = () => this.axis === "across" ? this.moveLeft() : this.moveUp();
}
