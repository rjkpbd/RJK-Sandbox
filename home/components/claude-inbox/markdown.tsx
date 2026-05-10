"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={className}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        // Headings
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-slate-100 mt-4 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-slate-100 mt-3 mb-1.5 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold text-slate-200 mt-3 mb-1 first:mt-0">{children}</h3>
        ),
        // Paragraph
        p: ({ children }) => (
          <p className="text-sm leading-relaxed text-slate-100 mb-2 last:mb-0">{children}</p>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
          >
            {children}
          </a>
        ),
        // Code block (wrapped by pre)
        pre: ({ children, className: cls }) => (
          <pre
            className={cn(
              "rounded-lg overflow-x-auto my-3 text-xs leading-relaxed",
              cls
            )}
          >
            {children}
          </pre>
        ),
        // Inline code vs block code
        code: ({ className: cls, children, ...props }) => {
          if (cls?.startsWith("language-")) {
            // Block code — let highlight.js handle colors via hljs classes
            return (
              <code className={cn(cls, "font-mono")} {...props}>
                {children}
              </code>
            );
          }
          // Inline code
          return (
            <code
              className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded text-[0.8em] font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-outside ml-5 mb-2 space-y-1 text-sm text-slate-100">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside ml-5 mb-2 space-y-1 text-sm text-slate-100">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-indigo-500 pl-3 my-2 text-slate-400 italic">
            {children}
          </blockquote>
        ),
        // Horizontal rule
        hr: () => <hr className="border-slate-700 my-4" />,
        // Strong / em
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-50">{children}</strong>
        ),
        em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
        // Table
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-slate-700">{children}</thead>,
        th: ({ children }) => (
          <th className="border border-slate-600 px-3 py-1.5 text-left font-semibold text-slate-200">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-slate-700 px-3 py-1.5 text-slate-300">{children}</td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
    </div>
  );
}
