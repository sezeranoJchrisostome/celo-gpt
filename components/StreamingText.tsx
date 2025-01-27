/**
 * @fileoverview
 *
 * This is meant to be the simplest component that can read text from a stream
 * and render it using a fade-in animation.
 *
 * I was both depressed and inspired by how uncooperative React is with such a
 * simple use case, especially for Safari. We did the best we could.
 */
import ReactDOMServer from "react-dom/server";
import { FC, HTMLAttributes, useEffect, useRef, useState } from "react";
import { useTextBuffer } from "../hooks/useTextBuffer";
import { FetchBufferOptions } from "../hooks/types";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import ReactMarkdown from "react-markdown";
import he from "he";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dark } from "react-syntax-highlighter/dist/cjs/styles/hljs";
// import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// import { dark } from "react-syntax-highlighter/dist/esm/styles/prism";

export interface StreamingTextProps extends HTMLAttributes<HTMLElement> {
  /**
   * The buffer of all text chunks received so far, updated as new chunks are
   * received.
   */
  buffer: string[];
  /**
   * The HTML element to render the text as. Defaults to `p`.
   */
  as?: keyof JSX.IntrinsicElements;
  /**
   * The duration of the fade-in animation in milliseconds. Defaults to 600.
   */
  fade?: number;
}

/**
 * StreamingText renders the chunks of an updating buffer of text with a fade-in
 * animation.
 *
 * @category Components
 *
 * @example
 * ```tsx
 * const { buffer, refresh, cancel, done } = useTextBuffer(url, 500);
 *
 * return (
 *  <div>
 *    <StreamingText buffer={buffer} />
 *    <button onClick={refresh} disabled={!done}>Refresh</button>
 *    <button onClick={cancel} disabled={done}>Cancel</button>
 *  </div>
 * )
 * ```
 */
export const StreamingText: FC<StreamingTextProps> = ({
  buffer,
  as: ElementType = "p",
  fade = 600,
  ...props
}) => {
  const text = buffer.join("");
  const empty = buffer.length === 0 || text.trim() === "";
  const [index, setIndex] = useState(0);
  const textRef = useRef<HTMLElement>(null);
  const fadedChunks = buffer.map((chunk, i) => {
    return (
      <span style={{ opacity: i < index ? 1 : 0 }} key={i}>
        {chunk}
      </span>
    );
  });

  /**
   * Handle resets and buffer size changes.
   */
  useEffect(() => {
    if (index >= buffer.length) {
      setIndex(buffer.length);
    }
  }, [buffer.length, index]);

  /**
   * Schedule a fade-in animation for the last span element and increment the
   * index.
   */
  useEffect(() => {
    const textElement = textRef.current;
    if (!textElement) return;

    const spanElements = textElement.getElementsByTagName("span");
    if (spanElements.length <= index) return;

    const lastSpan = spanElements[index];
    if (!lastSpan) return;

    const animation = lastSpan.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: fade,
      easing: "cubic-bezier(0.7, 0, 0.84, 0)",
    });

    animation.onfinish = () => {
      lastSpan.style.opacity = "1";
    };

    setIndex(index + 1);
  }, [buffer, fade, index]);
  const markdown = ReactDOMServer.renderToStaticMarkup(
    fadedChunks as any
  ).replace(/<\/?span[^>]*>/g, "");
  return (
    // @ts-ignore - ref any
    <p className="markdown" ref={textRef} {...props}>
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        children={ReactDOMServer.renderToStaticMarkup(fadedChunks as any)
          .replace(/<\/?span[^>]*>/g, "")
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")}
        remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <SyntaxHighlighter
                {...props}
                children={String(children).replace(/\n$/, "")}
                style={dark}
                language={match[1]}
                PreTag="div"
              />
            ) : (
              <code
                {...props}
                className={`py-[2px] rounded-md px-4 bg-[#FCF6F1]`}
              >
                {children}
              </code>
            );
          },
        }}
      />
    </p>
  );
};

export type StreamingTextURLProps = Omit<StreamingTextProps, "buffer"> &
  FetchBufferOptions;

/**
 * Wrapper around `<StreamingText>` that fetches the text stream from a URL.
 *
 * If you need to be able to refresh or cancel this stream, use `const { buffer,
 * refresh, cancel } = useTextBuffer()` alongside `<StreamingText
 * buffer={buffer}>` instead.
 *
 * @category Components
 *
 * @example
 * ```tsx
 * return (
 *  <StreamingTextURL url="/api/demo" fade={600} throttle={100} />
 * );
 * ```
 */
export const StreamingTextURL: FC<StreamingTextURLProps> = ({
  as,
  fade,
  url,
  throttle,
  data,
  method,
  ...props
}) => {
  const { buffer } = useTextBuffer({ url, throttle, data, method });
  return <StreamingText buffer={buffer} fade={fade} as={as} {...props} />;
};
