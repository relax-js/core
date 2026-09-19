import { compileTemplate } from '../../../src/html/template';
import { createPipeRegistry } from '../../../src/pipes';

interface ViewModel {
    name: string;
}

export const builtIn = compileTemplate<ViewModel>(`
    <p>{{name | uppercase | shorten:5}}</p>
    <p>{{name | upper}}</p>
    <p class="{{name | trim | capitalise}}"></p>
`);

const registry = createPipeRegistry();

export const custom = compileTemplate<ViewModel>(`
    <p>{{name | upper}}</p>
`, { strict: false, pipeRegistry: registry });

const config = { strict: true };

export const opaqueConfig = compileTemplate<ViewModel>(`
    <p>{{name | upper}}</p>
`, config);
