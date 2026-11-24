import { ComponentStyled, Style } from './base.js';

export default class Iframe extends ComponentStyled {
    constructor(style = {}) {
        super(document.createElement('iframe'), Style.create({}));
        this.element.setAttribute('crossorigin', 'anonymous');
        this.setStyle(style);
        this.lastHtmlcontent = null;
    }

    loadHtmlContent(content) {
        if (this.lastHtmlcontent == content) {
            return;
        }

        this.lastHtmlcontent = content;
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        this.element.src = url;
    }

    setOnloadContent(fn) {
        this.element.addEventListener('load', fn, false);
    }

    setIframContentHtmlStyle(style) {
        const content = this.element.contentDocument || this.element.contentWindow.document;
        if (!content || !content.documentElement) return;
        Object.keys(style).forEach(key => {
            if (key.startsWith('--')) {
                content.documentElement.style.setProperty(key, style[key], 'important');
            } else {
                content.documentElement.style[key] = style[key];
            }
        })
    }

    setIframContentStyleSheet(id, cssText) {
        const content = this.element.contentDocument || this.element.contentWindow.document;
        if (!content || !content.head) return;

        let style = content.getElementById(id);
        if (!style) {
            style = content.createElement('style');
            style.id = id;
            content.head.appendChild(style);
        }
        style.textContent = cssText;
    }

    setIframContentBodyStyle(style) {
        const content = this.element.contentDocument || this.element.contentWindow.document;
        Object.keys(style).forEach(key => {
            content.body.style[key] = style[key];
        })
    }
}
