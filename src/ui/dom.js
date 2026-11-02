/** Tiny DOM helper: h('div', { class: 'x', onclick }, child, 'text', [more]) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function icon(svg, cls = 'ico') {
  return h('span', { class: cls, html: svg, 'aria-hidden': 'true' });
}

export const fmt = (n) => Math.round(n).toLocaleString('en-US');

/** Brief toast inside the UI root. */
export function toast(root, text) {
  const t = h('div', { class: 'toast' }, text);
  root.append(t);
  setTimeout(() => t.classList.add('out'), 1600);
  setTimeout(() => t.remove(), 2100);
}
