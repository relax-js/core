/**
 * @module html
 * HTML template engine with update capabilities.
 * Creates templates that can be re-rendered with new data without recreating DOM nodes.
 */

import { defaultPipes } from "../pipes";

const pipes = defaultPipes;

interface Binding {
  originalValue?: unknown;
  setter: (instance: unknown) => void;
}

/**
 * Result of rendering a template.
 * Provides the DOM fragment and an update function for re-rendering.
 */
export interface RenderTemplate {
  /** The rendered DOM fragment */
  fragment: DocumentFragment;
  /** Updates the DOM with new data without recreating elements */
  update(context: any): void;
}

/**
 * Creates an updateable HTML template using tagged template literals.
 * Returns an object with the fragment and an update method for efficient re-rendering.
 *
 * Supports:
 * - Template literal substitutions (`${}`)
 * - Mustache-style bindings (`{{property}}`)
 * - Pipe transformations (`{{value|uppercase}}`)
 * - Event handler binding
 *
 * @param templateStrings - The static parts of the template literal
 * @param substitutions - The dynamic values interpolated into the template
 * @returns A function that takes context and returns a RenderTemplate
 *
 * @example
 * // Create and render a template
 * const template = html`
 *     <div class="user">
 *         <h2>{{name}}</h2>
 *         <p>{{email}}</p>
 *         <span>{{createdAt|daysAgo}}</span>
 *     </div>
 * `;
 *
 * const result = template({ name: 'John', email: 'john@example.com', createdAt: new Date() });
 * container.appendChild(result.fragment);
 *
 * // Later, update with new data
 * result.update({ name: 'Jane', email: 'jane@example.com', createdAt: new Date() });
 *
 * @example
 * // With event handlers
 * const row = html`
 *     <tr>
 *         <td>{{name}}</td>
 *         <td><button onclick=${function() { this.edit(this.id) }}>Edit</button></td>
 *     </tr>
 * `;
 */
export function html(
  templateStrings: TemplateStringsArray,
  ...substitutions: any[]
): (context: any) => RenderTemplate {
  // Preprocess template strings
  const template = document.createElement("template");
  const resolvedTemplate = resolveTemplate(templateStrings);
  template.innerHTML = resolvedTemplate;
  const bindings: Binding[] = [];

  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_ALL
  );
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      processElement(element, substitutions, bindings);
      if (customElements.get(element.tagName.toLowerCase())) {
        customElements.upgrade(element);
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const myNode = node;
      const text = myNode.textContent!;
      const result = parseTemplate(text, substitutions);
      if (result) {
        const hasSubstitutions = /€€\d+€€/.test(text);
        if (hasSubstitutions) {
          let startMarker: Comment | null = null;
          let endMarker: Comment | null = null;
          let insertedNodes: Node[] = [];
          bindings.push({
            originalValue: text,
            setter(instance) {
              var value = result(instance);
              if (!startMarker) {
                startMarker = document.createComment('');
                endMarker = document.createComment('');
                myNode.parentNode?.replaceChild(endMarker, myNode);
                endMarker.parentNode?.insertBefore(startMarker, endMarker);
              }
              insertedNodes.forEach(n => n.parentNode?.removeChild(n));
              insertedNodes = [];
              const temp = document.createElement('template');
              temp.innerHTML = value;
              const nodes = Array.from(temp.content.childNodes);
              const parent = endMarker!.parentNode!;
              nodes.forEach(n => {
                parent.insertBefore(n, endMarker);
                insertedNodes.push(n);
              });
            },
          });
        } else {
          bindings.push({
            originalValue: text,
            setter(instance) {
              var value = result(instance);
              myNode.textContent = value;
            },
          });
        }
      }
    }
  }

  // Return a function for binding
  return function bind(context: any): RenderTemplate {
    bindings.forEach((x) => {
      x.setter(context);
    });

    return {
      fragment: template.content,
      update(context: any) {
        bindings.forEach((x) => {
          x.setter(context);
        });
      },
    };
  };
}

function resolveTemplate(templateStrings: TemplateStringsArray): string {
  return templateStrings.raw
    .map((str, i) =>
      i < templateStrings.raw.length - 1 ? `${str}€€${i}€€` : str
    )
    .join("");
}

function processElement(
  element: HTMLElement,
  substitutions: any[],
  bindings: Binding[]
) {
  const attrBindings: Binding[] = [];

  for (const attr of Array.from(element.attributes)) {
    var attrValue = attr.value;
    if (attrValue == "") {
      continue;
    }

    const regex = /€€(\d+)€€/;
    const match = attrValue.match(regex);
    if (match) {
      const index = parseInt(match[1], 10);
      const func = substitutions[index];
      if (typeof func === "function") {
        attrBindings.push({
          setter(instance) {
            const boundFunction = func.bind(instance);
            element.removeAttribute(attr.name);
            element[attr.name] = boundFunction;
          },
        });

        continue;
      }
    }

    var attributeCallback = parseTemplate(attrValue, substitutions);
    if (attributeCallback == null) {
      continue;
    }

    attrBindings.push({
      originalValue: attrValue,
      setter(instance) {
        const value = attributeCallback!(instance) ?? attrValue;
        if (attr.name in element) {
          element[attr.name] = value;
        } else {
          attr.value = value;
        }
      },
    });
  }

  if (attrBindings.length > 0) {
    bindings.push({
      originalValue: element.tagName,
      setter(instance) {
        attrBindings.forEach((attrBinding) => attrBinding.setter(instance));
      },
    });
  }
}

type TemplateCallback = (instance: any) => string;


/**
 * Parse arguments for function calls in mustache expressions
 * Handles dot notation like row.id and nested properties
 */
function parseArguments(argsStr: string, instance: any): any[] {
  return argsStr.split(',').map(arg => {
    arg = arg.trim();

    if ((arg.startsWith('"') && arg.endsWith('"')) ||
        (arg.startsWith("'") && arg.endsWith("'"))) {
      return arg.slice(1, -1);
    }

    if (!isNaN(Number(arg))) {
      return Number(arg);
    }

    if (arg.includes('.')) {
      const parts = arg.split('.');
      let value = instance;
      for (const part of parts) {
        if (value === undefined || value === null) return undefined;
        value = value[part];
      }
      return value;
    }

    // Handle simple variable references
    return instance[arg];
  });
}


function parseTemplate(
  template: string,
  substitutions: any[]
): TemplateCallback | null {
  const regex = /€€(\d+)€€|{{\s*([^|]+?)(?:\|([\w|]+))?\s*}}/g;
  let lastIndex = 0;
  let match;

  const textBindings: TemplateCallback[] = [];
  while ((match = regex.exec(template)) !== null) {
    var value = template.slice(lastIndex, match.index);
    if (value.length > 0) {
      textBindings.push((_instance) => {
        return value;
      });
    }

    // ${}
    if (match[1]) {
      const index = parseInt(match[1], 10);
      const sub = substitutions[index];
      if (!sub) {
        continue;
      }

      if (typeof sub === "function") {
        const func = sub as Function;
        textBindings.push((instance) => {
          var result = func.apply(instance);
          return result;
        });
      } else {
        if (sub && sub.length > 0) {
          textBindings.push((instance) => {
            return sub;
          });
        }
      }
    } else if (match[2]) {
      // {{mustache|pipes}} case
      const mustacheName = match[2].trim();
      const argsStr = match[3] ? match[3].trim() : null;
      const matchingPipes = match[4]
        ? match[4].split("|").map((pipe) => pipe.trim())
        : [];

      textBindings.push((instance) => {
        var value = instance[mustacheName];

        if (typeof value === "function") {
          if (argsStr) {
            const args = parseArguments(argsStr, instance);
            value = value.apply(instance, args);
          } else {
            value = value.call(instance);
          }
        }

        matchingPipes.forEach((pipe) => {
          value = pipes[pipe](value);
        });
        return value;
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (textBindings.length == 0) {
    return null;
  }

  var val = template.slice(lastIndex);
  if (val.length > 0) {
    textBindings.push((_) => {
      return val;
    });
  }
  return (instance) => {
    var result = "";
    textBindings.forEach((binding) => {
      var value = binding(instance);
      result += value;
    });

    return result;
  };
}
