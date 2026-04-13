export class TableRenderer {
  private table: HTMLTableElement;
  private template: HTMLTemplateElement;
  private component: HTMLElement;
  private dataMap = new Map<string, Record<string, any>>();
  private rowMap = new Map<string, HTMLTableRowElement>();

  public IdColumn: string;

  constructor(
    table: HTMLTableElement,
    template: HTMLTemplateElement,
    idColumn: string,
    component: HTMLElement
  ) {
    this.table = table;
    this.template = template;
    this.IdColumn = idColumn;
    this.component = component;
  }

  public render(data: Record<string, any>[]) {
    this.clearRows();
    for (const item of data) {
      this.renderRow(item);
    }
  }

  private clearRows(): void {
    this.table.tBodies[0].innerHTML = '';
    this.dataMap.clear();
    this.rowMap.clear();
  }

  private renderRow(data: Record<string, any>): void {
    const id = data[this.IdColumn];
    if (id === undefined || id === null) {
      throw new Error(`Missing IdColumn '${this.IdColumn}' in data`);
    }

    const row = this.template.content.firstElementChild?.cloneNode(true) as HTMLTableRowElement;
    if (!row) throw new Error("Template must have a <tr> as its first child");

    this.populateRow(row, data);
    this.attachEventHandlers(row, data);

    this.table.tBodies[0].appendChild(row);
    this.dataMap.set(id, data);
    this.rowMap.set(id, row);
  }

  private populateRow(row: HTMLTableRowElement, data: Record<string, any>): void {
    const cells = row.querySelectorAll('[data-field]');
    cells.forEach((cell) => {
      const field = (cell as HTMLElement).dataset.field;
      if (field && field in data) {
        cell.textContent = String(data[field]);
      }
    });
  }

  private attachEventHandlers(row: HTMLElement, data: Record<string, any>): void {
    const interactiveElements = row.querySelectorAll('[onclick]');
    interactiveElements.forEach((el) => {
      const element = el as HTMLElement;
      const handlerAttr = element.getAttribute('onclick');
      if (!handlerAttr) return;

      const match = handlerAttr.match(/^(\w+)(\(([^)]*)\))?$/);
      if (!match) return;

      const [, methodName, , argStr] = match;
      const args = argStr ? argStr.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')) : [];

      if (typeof (this.component as any)[methodName] === 'function') {
        element.removeAttribute('onclick');
        element.addEventListener('click', (event) => {
          (this.component as any)[methodName](...args, data, event);
        });
      }
    });
  }

  public update(data: Record<string, any>) {
    const id = data[this.IdColumn];
    if (id === undefined || id === null) {
      throw new Error(`Missing IdColumn '${this.IdColumn}' in update data`);
    }

    const row = this.rowMap.get(id);
    if (!row) {
      this.renderRow(data);
    } else {
      this.populateRow(row, data);
      this.attachEventHandlers(row, data);
      this.dataMap.set(id, data);
    }
  }
}

export class SortChangeEvent extends CustomEvent<SortColumn[]> {
  constructor(sortColumns: SortColumn[]) {
    super('sortchange', {
      detail: sortColumns,
      bubbles: true,
      composed: true,
    });
  }
}


/** @internal */
type SortDirection = 'asc' | 'desc';
export type SortColumn = { column: string; direction: SortDirection };

export class TableSorter {
  private table: HTMLTableElement;
  private sortColumns: SortColumn[] = [];
  private component: HTMLElement;

  constructor(table: HTMLTableElement, component: HTMLElement) {
    this.table = table;
    this.component = component;
    this.setupListeners();
  }

  private setupListeners() {
    const headers = this.table.tHead?.querySelectorAll('th[name]');
    headers?.forEach((th) => {
      th.addEventListener('click', () => {
        const column = th.getAttribute('name')!;
        this.toggle(column);
        this.updateSortIndicators();
        this.emit();
      });
    });
  }

  private toggle(column: string) {
    const index = this.sortColumns.findIndex(c => c.column === column);

    if (index === -1) {
      this.sortColumns.push({ column, direction: 'asc' });
    } else if (this.sortColumns[index].direction === 'asc') {
      this.sortColumns[index].direction = 'desc';
    } else {
      this.sortColumns.splice(index, 1);
    }
  }

  private emit() {
    const event = new SortChangeEvent(this.sortColumns);
        this.component.dispatchEvent(event);
  }

   private updateSortIndicators() {
    const headers = this.table.tHead?.querySelectorAll('th[name]');
    headers?.forEach((el) => {
      const th = el as HTMLElement;
      // Remove existing indicators
      const existingIndicator = th.querySelector('.sort-indicator') as HTMLElement;
      if (existingIndicator) {
        th.removeChild(existingIndicator);
      }

      // Get column name and find if it's sorted
      const column = th.getAttribute('name')!;
      const sortInfo = this.sortColumns.find(c => c.column === column);
      
      if (sortInfo) {
        // Create indicator element
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.textContent = sortInfo.direction === 'asc' ? '↑' : '↓';
        
        // Style for right alignment
        indicator.style.float = 'right';
        indicator.style.marginLeft = '5px';
        
        // Append to header
        th.appendChild(indicator);
      }
      
      // Ensure header is positioned relatively for absolute positioning if needed
      if (!th.style.position) {
        th.style.position = 'relative';
      }
    });
  }

  public getSortColumns(): SortColumn[] {
    return [...this.sortColumns];
  }

  public clear() {
    this.sortColumns = [];
    this.updateSortIndicators();
    this.emit();
  }
}

declare global {
  interface HTMLTableElementEventMap extends HTMLElementEventMap {
    'sortchange': SortChangeEvent;
  }

  interface HTMLTableElement {
    addEventListener<K extends keyof HTMLTableElementEventMap>(
      type: K,
      listener: (this: HTMLTableElement, ev: HTMLTableElementEventMap[K]) => any,
      options?: boolean | AddEventListenerOptions
    ): void;
  }
}