// This is a hardcoded puzzle I'm using to test.
// We're gonna delete all the data in here someday, so we're keeping
// it all in this file to keep it separate from the real code.

import Grid from "./grid";

const hardcodedWalls = [
  6, 7, 11, 17, 18, 25, 26, 30, 35, 40, 41, 42, 59,
  63, 70, 77, 78, 82, 86, 90, 110, 114, 120, 124, 131,
  132, 133, 134, 139, 145, 156, 162, 166
];

export const gridObj = new Grid({
  width: 13,
  height: 13,
  tessellation: { x: 1, y: 1 },
});
for (const idx of hardcodedWalls) {
  gridObj.grid[idx].wall = true;
}
gridObj.renumber();

export const clues = {
  across: [
    [2, "Panel de ___"],
    [3, "Yiddish lament"],
    [4, "[Coerce]"],
    [7, "__ Arcana"],
    [8, "Ripped"],
    [9, "Not Dems. or Reps."],
    [12, "[Circumnavigation]"],
    [17, "2000 pounds"],
    [18, "___ Hawthorne"],
    [19, "Low-stakes"],
    [22, "Greek wedding shout"],
    [23, "Japanese theater"],
    [24, "[nth]"],
    [25, "First person to achieve 12A on Earth"],
    [29, "Health class topic, for short"],
    [30, "Chip dip"],
    [31, "Popular brand of nail polish"],
    [33, "[retail]"],
    [35, "Cutting ___"],
    [37, "Enjoy, relish"],
    [39, "[waterscape]"],
    [42, "Exams that aren't written"],
    [44, "[asi]"],
    [45, "Least quick"],
  ],
  down: [
    [1, "Egg"],
    [4, "Home of Coffin Flops"],
    [5, "Fantasy race"],
    [6, "___: Dream BBQ"],
    [8, "Spanish uncle"],
    [10, "[dvd]"],
    [11, "[sia]"],
    [12, "[cia]"],
    [13, "Canadian horseman"],
    [14, "Charlie hobby"],
    [15, "[alpaca]"],
    [16, "Frog princess"],
    [20, "[ahas]"],
    [21, "Dog breed of some sort"],
    [23, "[neopets]"],
    [25, "[jello]"],
    [26, "___ cone"],
    [27, "Anxiety causer"],
    [28, "In an overly trusting manner"],
    [32, "Code editor"],
    [34, "Airport fascists, init."],
    [36, "[grapenuts]"],
    [38, "Oarsman"],
    [39, "[was]"],
    [40, "[alt]"],
    [41, "[cincinnati]"],
  ]
};
