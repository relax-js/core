/**
 * Finds the closest parent element of a specific Web Component type.
 * Traverses up the DOM tree looking for an ancestor matching the constructor.
 *
 * Useful for child components that need to communicate with or access
 * their parent container component, common in composite component patterns.
 *
 * @template T - The type of HTMLElement to find
 * @param node - The starting node to search from
 * @param constructor - The class constructor of the desired element type
 * @returns The matching parent element or null if not found
 *
 * @example
 * // Inside a child component, find the parent container
 * class ListItem extends HTMLElement {
 *     connectedCallback() {
 *         const list = getParentComponent(this, ListContainer);
 *         if (list) {
 *             list.registerItem(this);
 *         }
 *     }
 * }
 *
 * @example
 * // Access parent component's methods
 * class TabPanel extends HTMLElement {
 *     activate() {
 *         const tabs = getParentComponent(this, TabContainer);
 *         tabs?.selectPanel(this);
 *     }
 * }
 *
 * @example
 * // Handle case where parent might not exist
 * const form = getParentComponent(input, FormContainer);
 * if (!form) {
 *     console.warn('Input must be inside a FormContainer');
 *     return;
 * }
 */
export function getParentComponent<T extends HTMLElement>(
    node: Node,
    constructor: { new (...args: any[]): T }
): T | null {
    let current = node.parentElement;

    while (current) {
        if (current instanceof constructor) {
            return current;
        }
        current = current.parentElement;
    }

    return null;
}   