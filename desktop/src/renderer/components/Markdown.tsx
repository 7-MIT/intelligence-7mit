import { Copy } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import 'highlight.js/styles/github-dark.css';
import { api } from '@/lib/api';
import { toast } from '@/lib/state';

function textOf(n: ReactNode): string {
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) return n.map(textOf).join('');
  if (n && typeof n === 'object' && 'props' in n) return textOf((n as { props: { children?: ReactNode } }).props.children);
  return '';
}

/** Markdown aman: tanpa HTML mentah, tautan dibuka di browser sistem, gambar eksternal diblokir (cegah eksfiltrasi lewat URL gambar). */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : '')}
        components={{
          a: ({ href, children }) => (
            <a href={href} onClick={(e) => { e.preventDefault(); if (href && /^https?:/i.test(href)) void api.system.openExternal(href); }} title={href}>{children}</a>
          ),
          img: ({ alt, src }) => <em title={src}>[gambar eksternal diblokir{alt ? `: ${alt}` : ''}]</em>,
          pre: ({ children }) => (
            <pre>
              <button className="icon-btn copy-btn" aria-label="Salin kode" onClick={() => { void navigator.clipboard.writeText(textOf(children)); toast('success', 'Kode disalin'); }}><Copy size={14} /></button>
              {children}
            </pre>
          )
        }}
      >{text}</ReactMarkdown>
    </div>
  );
});
