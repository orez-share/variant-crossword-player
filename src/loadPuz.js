// TODO: this module does ~no validation currently -- I'm really just
// building this thing so I can play my own puzzles, which I trust to be
// formatted correctly.
//
// I've tagged some points that could notably use validation, but don't
// assume these are exhaustive!

import Grid from "./grid.svelte.js";
import LoopingGrid from "./loopingGrid.svelte.js";
import vs from "./variants.js";

export const loadPuz = (ipuz) => {
  const {
    version,
    kind,
    title,
    copyright,
    author,
    notes,
    dimensions,
    viewport=dimensions, // tessellation
    tessellation, // tessellation
    block,
    empty,
    puzzle, // LabeledCell[][]
    solution, // CrosswordValue[][]
    clues: rawClues,
    lettersPerCell, // peapod
    ...rest
  } = ipuz;

  const variants = parseVariants(kind);
  const clues = parseClues(rawClues);
  const gridObj = parseGrid({
    variants,
    dimensions,
    puzzle,
    solution,
    block,
    empty,
    tessellation,
    clues,
    lettersPerCell,
  });

  return {
    variants,
    meta: { title, copyright, author, notes },
    viewport,
    gridObj,
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

const parseGrid = ({variants, dimensions, puzzle, solution, block, empty, tessellation, clues, lettersPerCell}) => {
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
  const args = { width, height, grid, solution: soln, tessellation, clues, lettersPerCell }
  return variants.includes(vs.LOOPING) ? new LoopingGrid(args) : new Grid(args);
}

const parseClues = (clues) => {
  // TODO: validation
  const { Across: across, Down: down } = clues;
  return { across, down };
}

const parseVariants = (kind) => {
  const variants = [];
  for (const k of kind) {
    switch (k) {
      case "http://ipuz.org/crossword#1":
        break;
      case "https://orez-share.github.io/peapods/format":
        variants.push(vs.PEAPOD);
        break;
      case "https://orez-share.github.io/crosswords/looping/format":
        variants.push(vs.LOOPING);
        break;
      default:
        console.warn(`unrecognized ipuz kind '${k}'. Ignoring.`);
    }
  }
  return variants;
}
