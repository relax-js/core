export function copyInputAttributes(
    source: HTMLElement,
    target: HTMLInputElement | HTMLTextAreaElement
): boolean {
    let copied = false;

    for (const key in target) {
        if (source.hasAttribute(key) && key in target) {
            target.setAttribute(key, source.getAttribute(key)!);
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

    for (const key of attributes) {
        if (source.hasAttribute(key)) {
            target.setAttribute(key, source.getAttribute(key)!);
            copied = true;
        }
    }

    return copied;
}
