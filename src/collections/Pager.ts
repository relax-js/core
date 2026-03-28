export class PageSelectedEvent extends Event {
  constructor(public page: number) {
    super('pageselected', {
      bubbles: true,
      composed: true,
    });
  }
}

declare global {
  interface HTMLElementEventMap {
    'pageselected': PageSelectedEvent;
  }
}

export class Pager {
  private container: HTMLElement;
  private totalCount: number;
  private pageSize: number;
  private currentPage: number = 1;

  constructor(container: HTMLElement, totalCount: number, pageSize: number) {
    this.container = container;
    this.totalCount = totalCount;
    this.pageSize = pageSize;

    this.render();
  }

  private render() {
    this.container.innerHTML = '';

    const pageCount = Math.max(1, Math.ceil(this.totalCount / this.pageSize));

    const createButton = (label: string, page: number, disabled: boolean = false) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.disabled = disabled;
      btn.addEventListener('click', () => this.selectPage(page));
      return btn;
    };

    this.container.appendChild(
      createButton('Previous', this.currentPage - 1, this.currentPage === 1)
    );

    for (let i = 1; i <= pageCount; i++) {
      const btn = createButton(i.toString(), i);
      if (i === this.currentPage) {
        btn.classList.add('selected');
      }
      this.container.appendChild(btn);
    }

    this.container.appendChild(
      createButton('Next', this.currentPage + 1, this.currentPage === pageCount)
    );
  }

  private selectPage(page: number) {
    const pageCount = Math.max(1, Math.ceil(this.totalCount / this.pageSize));
    if (page < 1 || page > pageCount || page === this.currentPage) return;

    this.currentPage = page;
    this.render();

    this.container.dispatchEvent(new PageSelectedEvent(this.currentPage));
  }

  public update(totalCount: number) {
    this.totalCount = totalCount;
    const pageCount = Math.max(1, Math.ceil(this.totalCount / this.pageSize));
    if (this.currentPage > pageCount) {
      this.currentPage = pageCount;
    }
    this.render();
  }

  public getCurrentPage(): number {
    return this.currentPage;
  }
}
