import { compileTemplate } from '../../../src/html/template';

export const untyped = compileTemplate(`
    <p>{{whatever.goes}} {{name | upper}}</p>
    <p>{{unclosed</p>
    <button r-clik="x()">y</button>
`);

const markup = '<p>{{name}}</p>';

export const fromVariable = compileTemplate<{ name: string }>(markup);

const title = 'Hi';

export const withSubstitution = compileTemplate<{ name: string }>(`<h1>${title}</h1><p>{{nmae}}</p>`);

export const stringLiteral = compileTemplate<{ name: string }>('<p>{{nmae}}</p>');
