import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SortChangeEvent, TableRenderer, TableSorter } from '../../src/html/TableRenderer';

let table: HTMLTableElement;
let template: HTMLTemplateElement;
let component: any;

function setupDOM() {
  document.body.innerHTML = `
    <table>
      <thead>
        <tr>
          <th name="name">Name</th>
          <th name="age">Age</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
    <template id="row-template">
      <tr>
        <td data-field="name"></td>
        <td data-field="age"></td>
        <td><button onclick="edit">Edit</button></td>
      </tr>
    </template>
  `;
  table = document.querySelector('table')!;
  template = document.querySelector('#row-template')!;
}

describe('TableRenderer', () => {
  beforeEach(() => {
    setupDOM();
    component = { edit: vi.fn() };
  });

  it('renders rows correctly', () => {
    const renderer = new TableRenderer(table, template, 'id', component);
    renderer.render([
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ]);
    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].children[0].textContent).toBe('Alice');
    expect(rows[1].children[1].textContent).toBe('25');
  });

  it('invokes component method on button click', () => {
    const renderer = new TableRenderer(table, template, 'id', component);
    renderer.render([{ id: 1, name: 'Alice', age: 30 }]);
    const button = table.querySelector('button')!;
    button.click();
    expect(component.edit).toHaveBeenCalledOnce();
    expect(component.edit).toHaveBeenCalledWith(
      { id: 1, name: 'Alice', age: 30 },
      expect.any(MouseEvent)
    );
  });

  it('updates a rendered row', () => {
    const renderer = new TableRenderer(table, template, 'id', component);
    renderer.render([{ id: 1, name: 'Alice', age: 30 }]);
    renderer.update({ id: 1, name: 'Alice Smith', age: 31 });
    const row = table.querySelector('tbody tr')!;
    expect(row.children[0].textContent).toBe('Alice Smith');
    expect(row.children[1].textContent).toBe('31');
  });

  it('adds a new row on update if not present', () => {
    const renderer = new TableRenderer(table, template, 'id', component);
    renderer.render([{ id: 1, name: 'Alice', age: 30 }]);
    renderer.update({ id: 2, name: 'Charlie', age: 45 });
    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[1].children[0].textContent).toBe('Charlie');
  });
});

describe('TableSorter', () => {
  beforeEach(() => {
    setupDOM();
    component = document.createElement('div');
    document.body.appendChild(component);
  });

  it('emits sortchange event with correct columns', () => {
    const sorter = new TableSorter(table, component);
    const events: any[] = [];
    component.addEventListener('sortchange', e => events.push(e));

    const nameTh = table.querySelector('th[name="name"]')!;
    nameTh.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(events.length).toBe(1);
    const e = events[0] as SortChangeEvent;
    expect(e.detail).toEqual([{ column: 'name', direction: 'asc' }]);
  });

  it('cycles direction asc → desc → none', () => {
    const sorter = new TableSorter(table, component);
    const nameTh = table.querySelector('th[name="name"]')!;

    nameTh.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sorter.getSortColumns()).toEqual([{ column: 'name', direction: 'asc' }]);

    nameTh.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sorter.getSortColumns()).toEqual([{ column: 'name', direction: 'desc' }]);

    nameTh.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sorter.getSortColumns()).toEqual([]);
  });
});