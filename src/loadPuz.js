// TODO: this module does ~no validation currently -- I'm really just
// building this thing so I can play my own puzzles, which I trust to be
// formatted correctly.
//
// I've tagged some points that could notably use validation, but don't
// assume these are exhaustive!

import Grid from "./grid.svelte.js";

export const loadPuz = (ipuz) => {
  const {
    version,
    kind,
    title,
    copyright,
    author,
    notes,
    dimensions,
    viewport=dimensions,
    tessellation,
    block,
    empty,
    puzzle, // LabeledCell[][]
    solution, // CrosswordValue[][]
    clues: rawClues,
    ...rest
  } = ipuz;

  const clues = parseClues(rawClues);

  return {
    meta: { title, copyright, author, notes },
    viewport,
    gridObj: parseGrid({dimensions, puzzle, solution, block, empty, tessellation, clues}),
    clues,
  };
}

// {
//   wall: false,
//   fill: "",
//   number: null,
// }

const parseLabeledCell = (lcell, block, empty) => {
  let { cell, style, value } = lcell;
  cell ??= lcell;
  // cell: block, empty, or num
  if (cell === block) return { wall: true };
  if (cell === empty) return { fill: "" };
  return { number: cell, fill: "" };
}

const parseCrosswordValue = (cval, block, empty) => {
  let { value, style, Direction } = cval;
  value ??= cval;
  // value: block, empty, or string
  // I don't understand what `empty` could mean, though.
  if (value === block) return null;
  return value;
}

const parseGrid = ({dimensions, puzzle, solution, block, empty, tessellation, clues}) => {
  // TODO: DEF validate `puzzle`/`solution` dimensions _somewhere_
  const {width, height} = dimensions;
  const grid = [];
  const soln = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid.push(parseLabeledCell(puzzle[y][x], block, empty));
      soln.push(parseCrosswordValue(solution[y][x], block, empty));
    }
  }
  return new Grid({ width, height, grid, solution: soln, tessellation, clues });
}

const parseClues = (clues) => {
  // TODO: validation
  const { Across: across, Down: down } = clues;
  return { across, down };
}
