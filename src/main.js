// Skyward Minis — entry point.
// Registers content (heroes, skills, maps), builds the game shell and opens Home.
import { Game } from './core/Game.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { StudioScreen } from './screens/StudioScreen.js';
import { BattleScreen } from './screens/BattleScreen.js';

// content registration (side-effect imports)
import './characters/lyra/index.js';
import './characters/shadeImp/index.js';
import './skills/lyraSkills.js';
import './skills/commonSkills.js';
import './maps/trainingGrounds.js';

function start(data = {}) {
  const mount = document.getElementById('app');
  mount.replaceChildren();
  const game = new Game(mount);
  game.register('home', new HomeScreen(game));
  game.register('studio', new StudioScreen(game));
  game.register('battle', new BattleScreen(game));

  // Keep the current screen across live updates of the published page.
  const valid = ['home', 'studio'];
  game.onScreen = (name) => {
    data.screen = name;
  };
  window.claude?.hot?.snapshot?.(() => ({ screen: valid.includes(data.screen) ? data.screen : 'home' }));
  game.go(valid.includes(data.screen) ? data.screen : 'home');
  window.__game = game;
}

if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
