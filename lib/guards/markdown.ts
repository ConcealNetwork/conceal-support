import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.setOptions({ gfm: true, breaks: true });

/**
 * Markdown → sanitized HTML for ticket bodies. Everything dynamic is stored as
 * Markdown; HTML is rendered at display time and again sanitized before it
 * reaches a browser, email or Discord.
 */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'target'],
      img: ['src', 'alt', 'title'],
      code: ['class'],
      span: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
    },
  });
}

export function mdToPlainText(md: string): string {
  return renderMarkdown(md)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Truncate for Discord embeds / email previews. */
export function excerpt(md: string, max = 300): string {
  const t = mdToPlainText(md);
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}
