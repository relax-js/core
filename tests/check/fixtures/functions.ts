import { compileTemplate } from '../../../src/html/template';

interface Row {
    id: number;
}

interface ViewModel {
    row: Row;
    name: string;
}

interface Handlers {
    save: (row: Row) => void;
    greet: (name: string, times: number) => string;
    now: () => string;
}

export const tpl = compileTemplate<ViewModel, Handlers>(`
    <p>{{now()}} {{greet(name, 2)}} {{greet('x', 1)}}</p>
    <p>{{sav(row)}}</p>
    <p>{{now(row)}}</p>
    <p>{{greet(row, 2)}}</p>
    <p>{{greet(name)}}</p>
    <p>{{greet(name, nope)}}</p>
    <p>{{now(event)}}</p>
    <button r-click="save(row)">ok</button>
    <button r-click="save(event)">wrong type</button>
    <button r-click="save(row, event)">too many</button>
    <button r-click="saev(row)">unknown</button>
`);
