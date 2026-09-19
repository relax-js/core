import { compileTemplate } from '../../../src/html/template';

interface Row {
    id: number;
    name: string;
    tags: string[];
    owner?: { email: string };
}

interface ViewModel {
    title: string;
    rows: Row[];
    busy: boolean;
    extra: Record<string, string>;
    loose: any;
}

interface Handlers {
    save: (row: Row, event: Event) => void;
    label: (prefix: string, count: number) => string;
}

export const tpl = compileTemplate<ViewModel, Handlers>(`
    <h1 class="page {{title | uppercase}}">{{title}}</h1>
    <p>{{label('rows', 3)}}</p>
    <ul>
        <li loop="row in rows" if="row.tags" unless="busy">
            {{row.name}} {{row.owner.email}} {{row.tags[0]}} {{rows[0].id}}
            <span loop="tag in row.tags">{{tag | shorten:5}}</span>
            <button r-click="save(row, event)" disabled="{{busy}}">Save</button>
        </li>
    </ul>
    <i>{{extra.anything}} {{loose.deep.path}}</i>
    <r-widget r-change="save(rows[0], event)"></r-widget>
    <form r-submit="save(rows[0], event)"></form>
    <input value="{{title}}">
`);
