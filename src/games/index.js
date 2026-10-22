import type_ from './type.js';
import sort from './sort.js';
import bugs from './bugs.js';
import phish from './phish.js';
import assemble from './assemble.js';
import tune from './tune.js';
import launch from './launch.js';
import chat from './chat.js';
import tensor from './tensor.js';
import boss from './boss.js';

/** game id (content.js `game` field) -> module */
export const games = { type: type_, sort, bugs, phish, assemble, tune, launch, chat, tensor, boss };
