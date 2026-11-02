// Enemy waves. Tiles are [unitId, col, row] on the enemy half (cols 4-7).
const LAYOUTS = [
  [['shadeImp', 5, 1], ['shadeImp', 6, 2], ['shadeImp', 5, 3]],
  [['shadeImp', 5, 0], ['shadeImp', 5, 2], ['shadeImp', 6, 1], ['shadeImp', 6, 3]],
  [['shadeBrute', 5, 1], ['shadeImp', 6, 0], ['shadeImp', 6, 3]],
  [['shadeBrute', 5, 2], ['shadeImp', 5, 0], ['shadeImp', 6, 1], ['shadeImp', 7, 3]],
  [['shadeBrute', 5, 1], ['shadeBrute', 6, 2], ['shadeImp', 6, 0], ['shadeImp', 5, 3]],
];

export function stageInfo(n) {
  const i = Math.min(n - 1, LAYOUTS.length - 1);
  const over = Math.max(0, n - LAYOUTS.length);
  return {
    number: n,
    name: `Stage ${n}`,
    enemies: LAYOUTS[i],
    // enemies get tougher every stage
    statScale: 1 + 0.08 * (n - 1) + 0.06 * over,
    maxRounds: 15,
  };
}
