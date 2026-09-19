import { compileTemplate } from '../../../src/html/template';

interface Row {
    id: number;
    cells: { value: string }[];
}

interface ViewModel {
    rows: Row[];
    title: string;
}

export const tpl = compileTemplate<ViewModel>(`
    <table>
        <tr loop="row in rows">
            <td loop="cell in row.cells">{{cell.value}} {{cell.valeu}}</td>
            <td>{{row.idd}}</td>
        </tr>
        <tr>{{row.id}}</tr>
    </table>
    <p loop="ch in title">{{ch}}</p>
    <p loop="rows">{{title}}</p>
    <p loop="row in rowz">{{row.id}}</p>
`);
