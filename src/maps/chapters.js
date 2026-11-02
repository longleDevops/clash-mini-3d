// Campaign structure: 4 chapters x 6 stages, each chapter fought on its own arena.
// Stages keep the global numbering the battle code and save file already use
// (save.stage = highest unlocked, save.bestStars[n]); this file maps them to
// "chapter-stage" labels and arenas.
export const STAGES_PER_CHAPTER = 6;

export const CHAPTERS = [
  {
    id: 1,
    name: 'Sky Sanctum',
    mapId: 'sky-sanctum',
    color: '#7fb2ff',
    emblem: 'star',
    blurb: 'Floating halls above the clouds, where the Shade Legion first broke through.',
  },
  {
    id: 2,
    name: 'Forest Grove',
    mapId: 'forest-grove',
    color: '#7ed46a',
    emblem: 'leaf',
    blurb: 'Mushroom glades and firefly lanterns, with shades hiding under every cap.',
  },
  {
    id: 3,
    name: 'Volcanic Forge',
    mapId: 'volcanic-forge',
    color: '#ff8a4c',
    emblem: 'flame',
    blurb: 'The shades stoke their forge on a stone ring above the lava.',
  },
  {
    id: 4,
    name: 'Frost Plateau',
    mapId: 'frost-plateau',
    color: '#a8dcff',
    emblem: 'snow',
    blurb: 'An ice citadel guarding the great sky crystal. The Legion makes its last stand here.',
  },
];

export const LAST_STAGE = CHAPTERS.length * STAGES_PER_CHAPTER;

export const getChapter = (id) => CHAPTERS.find((c) => c.id === Number(id)) || CHAPTERS[0];

export const globalStage = (chapterId, index) => (chapterId - 1) * STAGES_PER_CHAPTER + index;

/** Global stage number -> { chapter, index (1-6), label '1-3', boss } (bonus stages past the campaign stay on the last arena). */
export function stageRef(n) {
  n = Math.max(1, Math.floor(n || 1));
  if (n > LAST_STAGE) {
    const chapter = CHAPTERS[CHAPTERS.length - 1];
    return { n, chapter, index: STAGES_PER_CHAPTER, label: `Bonus ${n - LAST_STAGE}`, boss: false, bonus: true };
  }
  const chapter = CHAPTERS[Math.floor((n - 1) / STAGES_PER_CHAPTER)];
  const index = ((n - 1) % STAGES_PER_CHAPTER) + 1;
  return { n, chapter, index, label: `${chapter.id}-${index}`, boss: index === STAGES_PER_CHAPTER, bonus: false };
}

export const chapterForStage = (n) => stageRef(Math.min(n, LAST_STAGE)).chapter;

export function chapterStars(save, chapter) {
  let got = 0;
  for (let i = 1; i <= STAGES_PER_CHAPTER; i++) got += save.bestStars?.[globalStage(chapter.id, i)] || 0;
  return { got, max: STAGES_PER_CHAPTER * 3 };
}

export const isChapterUnlocked = (save, chapter) => save.stage >= globalStage(chapter.id, 1);
export const isStageUnlocked = (save, n) => n <= save.stage;

/** Star chests along the bottom of each chapter map. */
export const CHEST_STEPS = [
  { stars: 6, gems: 20, gold: 500 },
  { stars: 12, gems: 40, gold: 1000 },
  { stars: 18, gems: 80, gold: 2000 },
];
