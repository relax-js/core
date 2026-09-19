import { compileTemplate } from '../../../src/html/template';

interface ViewModel {
    id: number;
}

export const tpl = compileTemplate<ViewModel>(`
    <button r-click="save()">ok</button>
    <button r-clik="save()">typo</button>
    <button r-click="save">not a call</button>
    <r-pager r-pageselected="go()">custom event</r-pager>
    <r-pager r-click="go()">custom element</r-pager>
    <form r-submit="save(event)"></form>
`);
