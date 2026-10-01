"use client";

import { Check, Copy } from "lucide-react";
import { memo, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused; the text is still selectable.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy code"}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] text-[#c5c5c5] transition-colors hover:bg-white/10 hover:text-white"
    >
      {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

function Pre({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const code = textOf(children);
  const language = (() => {
    const child = Array.isArray(children) ? children[0] : children;
    const className = child && typeof child === "object" && "props" in child ? ((child as { props: { className?: string } }).props.className ?? "") : "";
    return className.match(/language-([\w-]+)/)?.[1] ?? "";
  })();
  return (
    <div className="code-card group/code relative my-4 overflow-hidden rounded-xl" data-code-card>
      <div className="flex items-center justify-between border-b border-white/10 bg-[#252526] py-1.5 pl-3 pr-1.5">
        <span className="flex items-center gap-2 font-mono text-[11px] text-[#9d9d9d]">
          <span className="flex gap-1" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          {language || "code"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre {...props} className="scrollbar-thin overflow-x-auto bg-[#1e1e1e] p-4 font-mono text-[13px] leading-[1.6] text-[#d4d4d4]">
        {children}
      </pre>
    </div>
  );
}

const components = {
  pre: Pre,
  a: ({ children, href, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" {...props}>
      {children}
    </a>
  ),
};

/** Assistant replies rendered as Markdown. Links open in a new tab; raw HTML is never rendered. */
export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]} components={components} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  );
});
