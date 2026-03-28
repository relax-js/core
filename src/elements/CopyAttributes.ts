export function copyInputAttributes(
    source: HTMLElement,
    target: HTMLInputElement | HTMLTextAreaElement
): boolean {
    let copied = false;

    for (const key in target) {
        if (source.hasAttribute(key) && key in target) {
            target.setAttribute(key, source.getAttribute(key));
            //(target as unknown)[key] = (source as unknown)[key];
            copied = true;
        }
    }

    return copied;
}
export function copyAttributes(
    source: HTMLElement,
    target: HTMLElement,
    attributes: string[]
): boolean {
    let copied = false;

    for (const key in attributes) {
        if (source.hasAttribute(key) && key in target) {
            target.setAttribute(key, source.getAttribute(key));
            //(target as unknown)[key] = (source as unknown)[key];
            copied = true;
        }
    }

    return copied;
}
