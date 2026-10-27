import { compileTemplate } from '../../../src/html/template';

interface ViewModel {
    users: { name: string }[];
    rows: string[];
}

export const tpl = compileTemplate<ViewModel>(`
    <p loop="u in users"><div>{{u.name}}</div></p>
    <my-grid><tr loop="r in rows"><td>{{r}}</td></tr></my-grid>
`);
