import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pager,PageSelectedEvent } from '../../src/collections/Pager';

let container: HTMLElement;
let events: PageSelectedEvent[];

beforeEach(() => {
  document.body.innerHTML = '<div id="pager"></div>';
  container = document.getElementById('pager')!;
  events = [];
});

function clickButtonWithText(text: string) {
  const btn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === text);
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('Pager', () => {
  it('renders correct number of buttons', () => {
    new Pager(container, 50, 10); // 5 pages

    const buttons = Array.from(container.querySelectorAll('button')).map(b => b.textContent);
    expect(buttons).toEqual(['Previous', '1', '2', '3', '4', '5', 'Next']);
  });

  it('highlights the current page', () => {
    new Pager(container, 20, 5); // 4 pages

    const selected = container.querySelector('button.selected')!;
    expect(selected.textContent).toBe('1');
  });

  it('emits event on page click', () => {
    const pager = new Pager(container, 30, 10); // 3 pages

    container.addEventListener('pageselected', (e) => events.push(e as PageSelectedEvent));
    clickButtonWithText('2');

    expect(events.length).toBe(1);
    expect(events[0].detail).toBe(2);
  });

  it('does not emit event on disabled prev/next', () => {
    const pager = new Pager(container, 10, 10); // 1 page

    container.addEventListener('pageselected', (e) => events.push(e as PageSelectedEvent));
    clickButtonWithText('Previous');
    clickButtonWithText('Next');

    expect(events.length).toBe(0);
  });

  it('updates total count and adjusts current page', () => {
    const pager = new Pager(container, 50, 10); // 5 pages

    clickButtonWithText('5'); // go to last page
    expect(container.querySelector('button.selected')!.textContent).toBe('5');

    pager.update(25); // only 3 pages now
    expect(container.querySelector('button.selected')!.textContent).toBe('3');
  });

  it('does not emit event when clicking current page', () => {
    const pager = new Pager(container, 30, 10); // 3 pages
    container.addEventListener('pageselected', (e) => events.push(e as PageSelectedEvent));

    clickButtonWithText('1'); // already on page 1
    expect(events.length).toBe(0);
  });
});