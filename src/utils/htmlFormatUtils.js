export const sanitizeHtml = (html) => {
    const allowedTags = [
        'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a', 'p', 'div', 'span'
    ];
    const allowedAttributes = {
        'a': ['href', 'target'],
        '*': ['style']
    };
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const clean = (node) => {
        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];
            if (child.nodeType === 1) {
                const tag = child.tagName.toLowerCase();
                if (!allowedTags.includes(tag)) {
                    const text = child.textContent;
                    const textNode = document.createTextNode(text);
                    node.replaceChild(textNode, child);
                    i--;
                } else {
                    // Remove all attributes except allowed ones
                    Array.from(child.attributes).forEach(attr => {
                        const attrName = attr.name;
                        if (!allowedAttributes['*']?.includes(attrName) &&
                            !allowedAttributes[tag]?.includes(attrName)) {
                            child.removeAttribute(attrName);
                        }
                    });
                    clean(child);
                }
            }
        }
    };
    
    clean(tempDiv);
    return tempDiv.innerHTML;
};

export const convertHtmlToPlainText = (html) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
};