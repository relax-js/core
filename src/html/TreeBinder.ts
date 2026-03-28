import { compileMustard } from "../templates/parseTemplate";

type Binding =
    | { type: 'text'; path: number[]; template: string, func: (context: Record<string, any>, node: Node) => void }
    | { type: 'attribute'; name: string, path: number[]; value: string, func: (context: Record<string, any>, element: HTMLElement) => void };

export class Template {
    private readonly template: HTMLDivElement;
    private readonly bindings: Binding[];

    constructor(html: string) {
        this.template = document.createElement('div');
        this.template.innerHTML = html;
        this.bindings = this.collectBindings(this.template);
    }

    render(data: Record<string, any>): HTMLElement {
        const clone = this.template.cloneNode(true) as HTMLElement;

        for (const binding of this.bindings) {
            const node = this.getNodeAtPath(clone, binding.path);
            if (binding.type === 'text') {
                binding.func(data, node);
            } else if (binding.type === 'attribute') {
                binding.func(data, node as HTMLElement);
            }
        }

        return clone;
    }

    private collectBindings(root: HTMLElement): Binding[] {
        const bindings: Binding[] = [];

        const walk = (node: Node, path: number[] = []) => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent) {
                if (node.textContent.match(/\{\{\s*(.*?)\s*\}\}/g)) {
                    var func = compileMustard(node.textContent)
                    bindings.push({
                        type: 'text', path: [...path], template: node.textContent, func: (data, myNode) => {
                            var value = func(data);
                            myNode.textContent = value;
                        }
                    });
                }
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                for (let i = 0; i < element.attributes.length; i++) {
                    const attr = element.attributes[i];
                    if (attr.value.match(/\{\{\s*(.*?)\s*\}\}/g)) {
                        var func = compileMustard(attr.value);
                        const attrName = attr.name;

                        bindings.push({
                            type: 'attribute', path: [...path], name: attr.name, value: attr.value, func: (data, el) => {
                                var value = func(data);
                                el.setAttribute(attrName, value);
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

    private getNodeAtPath(root: Node, path: number[]): Node {
        return path.reduce((node, index) => node.childNodes[index], root);
    }

    private resolveVariable(data: any, path: string): any {
        return path.split('.').reduce((obj, key) => obj?.[key], data) ?? '';
    }
}
