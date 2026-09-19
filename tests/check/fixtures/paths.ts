import { compileTemplate } from '../../../src/html/template';

interface Profile {
    name: string;
    email: string;
}

interface ViewModel {
    user: Profile | null;
    count: number;
    items: string[];
}

export const tpl = compileTemplate<ViewModel>(`
    <p>{{usr.name}}</p>
    <p>{{user.naem}}</p>
    <p>{{count.length}}</p>
    <p>{{count[0]}}</p>
    <p>{{items[0].length}}</p>
    <p if="user.emial">x</p>
    <p unless="items.size">x</p>
    <p>{{user name}}</p>
    <a href="/u/{{user.id}}">y</a>
`);
