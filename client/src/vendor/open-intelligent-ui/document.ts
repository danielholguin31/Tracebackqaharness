import { THEME_CSS, SVG_CLASSES_CSS, FORM_STYLES_CSS } from "./design-system";

// Adapted from OpenIntelligentUI's MCP assembler; network and same-origin access are disabled.
export function assembleDocument(html: string, dark = false) {
  const theme = [THEME_CSS, SVG_CLASSES_CSS, FORM_STYLES_CSS]
    .join("\n")
    .replaceAll(
      "@media (prefers-color-scheme: dark)",
      dark ? "@media all" : "@media not all",
    );
  return `<!doctype html><html${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><style>${theme}body{margin:0;padding:16px;overflow-wrap:anywhere}#content{max-width:100%;overflow:auto}*{box-sizing:border-box}</style></head><body><div id="content">${html}</div><script>
window.sendPrompt=function(text){parent.postMessage({type:'traceback-prompt',text},'*')};
window.openLink=function(url){parent.postMessage({type:'traceback-link',url},'*')};
document.addEventListener('click',function(e){var a=e.target.closest('a[href]');if(a){e.preventDefault();window.openLink(a.getAttribute('href'))}});
new ResizeObserver(function(){parent.postMessage({type:'traceback-resize',height:document.getElementById('content').scrollHeight+32},'*')}).observe(document.getElementById('content'));
</script></body></html>`;
}
