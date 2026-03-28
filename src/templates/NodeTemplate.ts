import { compileMustard } from "./parseTemplate";
import { ArgToken, tokenizeArgs } from "./tokenizer";

type RawBinding =
  | {
    type: 'text';
    path: number[];
    func: (context: Record<string, any>, component: Record<string, any>, node: Node) => void;
  }
  | {
    type: 'attribute';
    path: number[];
    name: string;
    func: (context: Record<string, any>, component: Record<string, any>, element: HTMLElement) => void;
  };

type ClickBinding = {
  path: number[];
  methodName: string;
  argTokens: ArgToken[];
};

type BoundBinding =
  | {
    type: 'text';
    node: Node;
    func: (context: Record<string, any>, node: Node) => void;
  }
  | {
    type: 'attribute';
    element: HTMLElement;
    name: string;
    func: (context: Record<string, any>, element: HTMLElement) => void;
  };

export class BoundNode {
  constructor(
    private readonly root: HTMLElement,
    private readonly bindings: BoundBinding[],
    private readonly clickBindings: ClickBinding[],
    private readonly component?: Record<string, any>
  ) { }

  render(data: Record<string, any>): HTMLElement {
    for (const binding of this.bindings) {
      if (binding.type === 'text') {
        binding.func(data, binding.node);
      } else {
        binding.func(data, binding.element);
      }
    }

    for (const click of this.clickBindings) {
      const node = this.getNodeAtPath(this.root, click.path);
      const method = this.component?.[click.methodName];

      if (node instanceof HTMLElement && typeof method === 'function') {
        node.onclick = (evt: Event) => {
          const args = click.argTokens.map(token => {
            if (token.type === 'number' || token.type === 'string') {
              return token.value;
            }
            if (token.type === 'identifier') {
              if (token.value === 'event') {
                return evt;
              }

              const parts = token.value.split('.');
              return parts.reduce((obj, key) => obj?.[key], data);
            }
          });
          method.apply(this.component, args);
        };
      }
    }

    return this.root;
  }

  private getNodeAtPath(root: Node, path: number[]): Node {
    return path.reduce((node, index) => node.childNodes[index], root);
  }
}

export function createBluePrint(html: string): Blueprint {
  var bp = new Blueprint(html);
  return bp;
}

export class Blueprint {
  private readonly template: HTMLTemplateElement;
  private readonly bindings: RawBinding[];
  private readonly clickBindings: ClickBinding[];

  constructor(htmlOrTemplate: string | HTMLTemplateElement) {
    if (typeof htmlOrTemplate === 'string') {
      const trimmed = htmlOrTemplate.trim();
      if (trimmed.startsWith('<template')) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = trimmed;
        const found = wrapper.querySelector('template');
        if (!found) throw new Error('Could not find <template> in input string');
        this.template = found;
      } else {
        this.template = document.createElement('template');
        this.template.innerHTML = trimmed;
      }
    } else {
      this.template = htmlOrTemplate;
    }

    const rootElement = this.getRootElement();
    this.bindings = this.collectBindings(rootElement);
    this.clickBindings = this.collectClickBindings(rootElement);
  }

  createInstance(component?: Record<string, any>): BoundNode {
    const rootClone = this.getRootElement().cloneNode(true) as HTMLElement;

    const boundBindings: BoundBinding[] = this.bindings.map(binding => {
      const node = this.getNodeAtPath(rootClone, binding.path);
      if (binding.type === 'text') {
        return {
          type: 'text',
          node,
          func: (data, node) => binding.func(data, component, node)
        };
      } else {
        return {
          type: 'attribute',
          element: node as HTMLElement,
          name: binding.name,
          func: (data, node) => binding.func(data, component, node)
        };
      }
    });

    return new BoundNode(rootClone, boundBindings, this.clickBindings, component);
  }

  private getRootElement(): HTMLElement {
    const el = Array.from(this.template.content.childNodes).find(
      node => node.nodeType === Node.ELEMENT_NODE
    );
    if (!(el instanceof HTMLElement)) {
      throw new Error('Template must contain a single root element');
    }
    return el;
  }

  private collectBindings(root: HTMLElement): RawBinding[] {
    const bindings: RawBinding[] = [];

    const walk = (node: Node, path: number[] = []) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        if (node.textContent.match(/\{\{\s*(.*?)\s*\}\}/g)) {
          const func = compileMustard(node.textContent);
          bindings.push({
            type: 'text',
            path: [...path],
            func: (data, component, targetNode) => {
              targetNode.textContent = func(data, component);
            }
          });
        }
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;

        if (element.tagName === 'TEMPLATE') return;

        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          if (attr.value.match(/\{\{\s*(.*?)\s*\}\}/g)) {
            const func = compileMustard(attr.value);
            bindings.push({
              type: 'attribute',
              path: [...path],
              name: attr.name,
              func: (data, component, el) => {
                el.setAttribute(attr.name, func(data, component));
              }
            });
          }
        }

        Array.from(node.childNodes).forEach((child, index) => {
          walk(child, [...path, index]);
        });
      }
    };

    walk(root);
    return bindings;
  }

  private collectClickBindings(root: Node): ClickBinding[] {
    const bindings: ClickBinding[] = [];

    const walk = (node: Node, path: number[] = []) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const clickAttr = element.getAttribute('click');
        if (clickAttr?.trim()) {
          const trimmed = clickAttr.trim();

          const match = trimmed.match(/^([a-zA-Z_$][\w$]*)\s*\((.*)\)$/);
          if (match) {
            const methodName = match[1];
            const argTokens = tokenizeArgs(trimmed);
            bindings.push({ path: [...path], methodName, argTokens });
          } else {
            // No parentheses — treat as method with no args
            bindings.push({ path: [...path], methodName: trimmed, argTokens: [] });
          }
        }

        Array.from(node.childNodes).forEach((child, index) => {
          walk(child, [...path, index]);
        });
      }
    };

    walk(root);
    return bindings;
  }

  private getNodeAtPath(root: Node, path: number[]): Node {
    return path.reduce((node, index) => node.childNodes[index], root);
  }
}
