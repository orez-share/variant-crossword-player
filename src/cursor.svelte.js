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

  setSelected = (coord) => {
    const { gridObj } = this;
    let { x, y, idx } = gridObj.localCoord(coord);
    if (gridObj.grid[idx].wall) return false;

    this.x = x;
    this.y = y;
    this.idx = idx;
    return true;
  }

  toggleFace = () => {
    this.axis = this.axis === "across" ? "down" : "across";
  }

  prevWord = () => {
    const [num, idx] = this.gridObj.prevWordFrom({ number: this.line.number, axis: this.axis });
    this.setSelected({idx});
  }

  nextWord = () => {
    const [num, idx] = this.gridObj.nextWordFrom({ number: this.line.number, axis: this.axis });
    this.setSelected({idx});
  }
}
