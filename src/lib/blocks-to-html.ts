/**
 * Strapi Blocks JSON -> HTML, for the site's build.
 *
 * ⭐ COPIED from `strapi-cms/src/render/blocks-to-html.ts` on 24 Sep 2026, when
 * the site began reading Strapi. The two repos are separate and nothing
 * publishes this as a package, so the copy is deliberate: change both together.
 * The round-trip test against the real corpus lives there; the unit cases are
 * mirrored in `__tests__/blocks-to-html.test.ts`.
 *
 * ⛔ ONE DELIBERATE DIFFERENCE FROM THAT COPY: a list item's and a quote's text
 * is wrapped in `<p>`, because that is the markup Directus served and the page
 * CSS is written against it. `p { margin: 0 0 var(--paragraph-gap) }` (base.css)
 * is what spaces list items apart; without the `<p>` every list on the site
 * would render tighter than it does today — measured in the page-by-page diff of
 * 24 Sep 2026. (`.entry__body blockquote p { margin: 0 }`, so the quote's `<p>`
 * changes nothing a reader sees; it keeps the markup identical.)
 *
 * ## Why this is ours, stated explicitly
 *
 * The reuse rule says build bespoke only where it is the differentiation, and
 * say so. This is not differentiation — it is that the dependency is smaller
 * than its own risk. Measured 18 Sep 2026:
 *
 *   blocks-html-renderer          10 stars, 1 open issue, 8 releases with a
 *                                 21-month gap (Jan 2024 -> Oct 2025), no
 *                                 OpenSSF scorecard. Plain JS, right shape.
 *   @strapi/blocks-react-renderer Strapi's own, 240 stars, 34 open issues,
 *                                 last pushed Apr 2025. REACT ONLY - the site
 *                                 is static Astro with no React today.
 *
 * The Blocks node set is CLOSED and enumerable, fixed by Strapi's own
 * validator (`@strapi/core/.../entity-validator/blocks-validator.js`):
 * paragraph, heading, list, list-item, quote, code, image, link, and text with
 * five marks. It cannot grow without a Strapi release. We already own and test
 * the inverse direction in `../seed/html-to-blocks.ts`, so this is the other
 * half of a pair rather than a new capability.
 *
 * ⚠️ If this ever stops being worth owning, `blocks-html-renderer` is the
 * fallback and the swap is isolated to this module.
 *
 * ## What the site needs, specifically
 *
 * ⛔ A `<blockquote>` must come out as `<blockquote>`. It is the learning line,
 * styled by `.entry__body--activity blockquote` (components.css:1030) as the
 * green-wash block. Anything else silently unstyles it.
 * ⛔ Inline images must resolve. 37 files in aikyam.space live ONLY inside
 * story and page bodies, and the site regenerates a responsive srcset from
 * their real dimensions.
 */

type Mark = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code';

type TextNode = {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};
type LinkNode = { type: 'link'; url: string; children: TextNode[] };
type InlineNode = TextNode | LinkNode;

export type ImageNode = {
  type: 'image';
  image: { url: string; alternativeText?: string | null; width?: number; height?: number };
  children?: unknown[];
};

export type BlockNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: number; children: InlineNode[] }
  | { type: 'quote'; children: InlineNode[] }
  | { type: 'code'; children: TextNode[] }
  // ⛔ A list's children are list-items OR MORE LISTS. Strapi's own validator
  // says so (`listChildrenValidator` in blocks-validator.js branches on both),
  // and the Blocks editor produces a nested list the moment an editor indents a
  // bullet.
  | { type: 'list'; format: 'ordered' | 'unordered'; children: ListChild[] }
  | ImageNode;

export type ListItemNode = { type: 'list-item'; children: InlineNode[] };
export type ListNode = {
  type: 'list';
  format: 'ordered' | 'unordered';
  children: ListChild[];
};
export type ListChild = ListItemNode | ListNode;

export type Options = {
  /**
   * Rewrites an image's stored URL — the site serves media from its own origin
   * and adds a srcset, which this module deliberately does not know about.
   */
  imageSrc?: (node: ImageNode) => string;
};

/**
 * ⛔ Every text node is escaped. Bodies are written by five editors and one of
 * them typing `a < b` would otherwise produce broken markup on a live page —
 * or worse, since the same path carries anything they paste.
 */
function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Attribute values need the quote characters escaped too, not just the angles. */
function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Applied outermost-first so the nesting is stable and diffable.
const MARKS: Array<[Mark, string]> = [
  ['bold', 'strong'],
  ['italic', 'em'],
  ['underline', 'u'],
  ['strikethrough', 's'],
  ['code', 'code'],
];

function renderText(node: TextNode): string {
  // ⚠️ A newline inside a text node is a real line break — html-to-blocks emits
  // one for `<br>` and between flattened paragraphs inside a quote or list
  // item. Collapsing it back to a space loses the author's break.
  let html = escapeText(node.text).replace(/\n/g, '<br>');
  for (const [mark, tag] of [...MARKS].reverse()) {
    if (node[mark]) html = `<${tag}>${html}</${tag}>`;
  }
  return html;
}

function renderInline(nodes: InlineNode[] | undefined): string {
  if (!nodes) return '';
  return nodes
    .map((n) => {
      if (n.type === 'link') {
        const inner = (n.children || []).map(renderText).join('');
        return `<a href="${escapeAttr(n.url || '')}">${inner}</a>`;
      }
      return renderText(n as TextNode);
    })
    .join('');
}

/**
 * ⛔ Lists nest, and an earlier version of this assumed they did not. It mapped
 * every child straight to `<li>${renderInline(child.children)}</li>`, so a
 * nested list handed a `list-item` node to `renderText` and the whole build
 * died with `TypeError: Cannot read properties of undefined (reading
 * 'replace')` — a raw crash, not the loud "unknown block type" this module
 * promises for anything it does not understand.
 *
 * ⚠️ The round trip cannot catch this, which is why it survived a green suite:
 * `html-to-blocks.ts` FLATTENS nested lists, so the corpus converted from
 * Directus never contains one. The first activity an editor indents a bullet in
 * would have produced it.
 *
 * A nested list is emitted inside the preceding `<li>`, which is where HTML
 * wants it — a bare `<ul>` between `<li>`s is invalid and renders unindented.
 */
function renderList(block: ListNode): string {
  const tag = block.format === 'ordered' ? 'ol' : 'ul';
  const parts: string[] = [];
  for (const child of block.children || []) {
    if (child.type === 'list') {
      const nested = renderList(child);
      if (parts.length) {
        // Fold it into the previous item rather than leaving it a sibling.
        parts[parts.length - 1] = parts[parts.length - 1].replace(/<\/li>$/, `${nested}</li>`);
      } else {
        parts.push(`<li>${nested}</li>`);
      }
      continue;
    }
    if (child.type === 'list-item') {
      parts.push(`<li><p>${renderInline(child.children)}</p></li>`);
      continue;
    }
    throw new Error(
      `blocksToHtml: unknown list child ${JSON.stringify((child as any)?.type)}`
    );
  }
  return `<${tag}>${parts.join('')}</${tag}>`;
}

export function blocksToHtml(blocks: BlockNode[] | null | undefined, opts: Options = {}): string {
  if (!Array.isArray(blocks)) return '';
  const out: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph': {
        const inner = renderInline(block.children);
        // An empty paragraph is structural noise from the converter's own
        // "every block needs one text node" rule, not something an author
        // wrote. Emitting it adds a blank gap to the page.
        if (inner.trim()) out.push(`<p>${inner}</p>`);
        break;
      }
      case 'heading': {
        const level = Math.min(6, Math.max(1, Number(block.level) || 1));
        out.push(`<h${level}>${renderInline(block.children)}</h${level}>`);
        break;
      }
      case 'quote':
        // ⛔ blockquote, not <p class="quote">. See the header.
        out.push(`<blockquote><p>${renderInline(block.children)}</p></blockquote>`);
        break;
      case 'code':
        out.push(
          `<pre><code>${escapeText((block.children || []).map((c) => c.text).join(''))}</code></pre>`
        );
        break;
      case 'list':
        out.push(renderList(block));
        break;
      case 'image': {
        const src = opts.imageSrc ? opts.imageSrc(block) : block.image?.url;
        if (!src) break;
        const alt = escapeAttr(block.image?.alternativeText || '');
        const w = block.image?.width;
        const h = block.image?.height;
        // ⚠️ width/height are emitted when known. The site throws rather than
        // ship an unsized asset, because a missing dimension is what makes a
        // page reflow as images load.
        const dims = w && h ? ` width="${w}" height="${h}"` : '';
        out.push(`<img src="${escapeAttr(src)}" alt="${alt}"${dims}>`);
        break;
      }
      default:
        // ⛔ Loud. A node type this does not know is a Strapi release adding
        // one, and silently dropping it would take a paragraph off a live page
        // with nothing to notice it by.
        throw new Error(
          `blocksToHtml: unknown block type ${JSON.stringify((block as any)?.type)}`
        );
    }
  }

  return out.join('');
}
