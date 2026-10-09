import { useEffect, useMemo, useRef, useState } from "react";
import { assembleDocument } from "@/vendor/open-intelligent-ui/document";

export function IntelligentArtifact({
  html,
  title = "Operator artifact",
}: {
  html: string;
  title?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(240);
  const [prompt, setPrompt] = useState("");
  const [link, setLink] = useState("");
  const [notice, setNotice] = useState("");
  const [dark, setDark] = useState(
    document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark")),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  const documentHtml = useMemo(
    () => assembleDocument(html, dark),
    [html, dark],
  );
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        !event.data ||
        typeof event.data !== "object"
      )
        return;
      if (
        event.data.type === "traceback-resize" &&
        Number.isFinite(event.data.height)
      )
        setHeight(Math.max(120, Math.min(800, event.data.height)));
      if (
        event.data.type === "traceback-prompt" &&
        typeof event.data.text === "string" &&
        event.data.text.trim().length <= 4000
      )
        setPrompt(event.data.text.trim());
      if (
        event.data.type === "traceback-link" &&
        typeof event.data.url === "string"
      ) {
        try {
          const u = new URL(event.data.url);
          if (u.protocol === "https:" && !u.username && !u.password)
            setLink(u.href);
        } catch {}
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return (
    <section className="intelligent-artifact">
      <iframe
        ref={frame}
        title={title}
        sandbox="allow-scripts"
        srcDoc={documentHtml}
        style={{ width: "100%", height, border: 0 }}
      />
      {prompt && (
        <div className="v2-state">
          <p>{prompt}</p>
          <button
            className="btn-precision btn-primary"
            onClick={() => {
              const accepted = window.dispatchEvent(
                new CustomEvent("traceback:operator-prompt", {
                  detail: { text: prompt },
                  cancelable: true,
                }),
              );
              if (accepted) {
                setPrompt("");
                setNotice("");
              } else
                setNotice("Operator is busy. Wait for the current answer.");
            }}
          >
            Send follow-up
          </button>
          <button
            className="btn-precision btn-secondary"
            onClick={() => setPrompt("")}
          >
            Dismiss
          </button>
          {notice && <p role="status">{notice}</p>}
        </div>
      )}
      {link && (
        <div className="v2-state">
          <p>{link}</p>
          <a
            className="btn-precision btn-secondary"
            href={link}
            target="_blank"
            rel="noreferrer"
          >
            Open external link
          </a>
          <button
            className="btn-precision btn-secondary"
            onClick={() => setLink("")}
          >
            Dismiss link
          </button>
        </div>
      )}
    </section>
  );
}
