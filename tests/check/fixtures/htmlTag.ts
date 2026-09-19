import { html } from '../../../src/html/html';

interface Card {
    name: string;
    user: { email: string };
    greet(name: string): string;
    stamp(): string;
    format(a: string, b: number): string;
}

declare const card: Card;
declare const onEdit: () => void;

export const immediate = html`
    <h2>{{name}} {{nmae}}</h2>
    <p>{{user.email}}</p>
    <p>{{greet|name}} {{greet|nope}} {{greet|user.email}} {{greet|name, name}}</p>
    <p>{{stamp}} {{stamp|name}} {{name|name}}</p>
    <p>{{format|'x', 2}} {{format|2, 'x'}}</p>
    <button onclick=${onEdit} title="{{titel}}">Edit</button>
    <p>{{unclosed</p>
`(card);

const stored = html`<p>{{missing}}</p>`;
export const bound = stored({ present: 1 });

export const inline = (label: string) => html`<i>{{label}} {{lable}}</i>`({ label });

class Widget {
    private template = html`<b>{{count}} {{cuont}}</b>`;
    render() {
        return this.template({ count: 1 });
    }
}
export const widget = new Widget();

export const unbound = html`<p>{{anything}}</p>`;

export function later() {
    return html`<p>{{anything}}</p>`;
}
