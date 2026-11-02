// Skyward Minis — entry point.
// Registers content (heroes, skills, maps), builds the game shell and opens Home.
import { Game } from './core/Game.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { StudioScreen } from './screens/StudioScreen.js';
import { BattleScreen } from './screens/BattleScreen.js';
import { WorldMapScreen } from './screens/WorldMapScreen.js';
import { ChapterScreen } from './screens/ChapterScreen.js';

// content registration (side-effect imports)
import './characters/lyra/index.js';
import './characters/shadeImp/index.js';
import './skills/lyraSkills.js';
import './skills/commonSkills.js';
// maps: four battle arenas (one per chapter) + the hub / world / chapter scenes
import './maps/arenas/skySanctum.js';
import './maps/arenas/forestGrove.js';
import './maps/arenas/volcanicForge.js';
import './maps/arenas/frostPlateau.js';
import './maps/scenes/skywardHaven.js';
import './maps/scenes/worldMap.js';
import './maps/scenes/chapterMap.js';

function start(data = {}) {
  const mount = document.getElementById('app');
  mount.replaceChildren();
  const game = new Game(mount);
  game.register('home', new HomeScreen(game));
  game.register('studio', new StudioScreen(game));
  game.register('battle', new BattleScreen(game));
  game.register('world', new WorldMapScreen(game));
  game.register('chapter', new ChapterScreen(game));

  // Keep the current screen across live updates of the published page.
  const valid = ['home', 'studio', 'world', 'chapter'];
  game.onScreen = (name) => {
    data.screen = name;
  };
  window.claude?.hot?.snapshot?.(() => ({ screen: valid.includes(data.screen) ? data.screen : 'home' }));
  game.go(valid.includes(data.screen) ? data.screen : 'home');
  window.__game = game;
}

if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
