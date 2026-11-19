import type { ReactNode } from "react";

export function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  const inline = (value: string) => value.split(/(\*\*.*?\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.replace(/`([^`]+)`/g, "$1"));
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    if (line.startsWith("```")) {
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith("```")) code.push(lines[index++]);
      index += 1;
      blocks.push(<pre className="markdown-code" key={`code-${index}`}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    if (/^\|/.test(line)) {
      const tableLines: string[] = [];
      while (index < lines.length && /^\s*\|/.test(lines[index])) tableLines.push(lines[index++]);
      const rows = tableLines.filter((row) => !/^\s*\|?\s*:?-{3,}/.test(row)).map((row) => row.split("|").slice(1, -1).map((cell) => cell.trim()));
      blocks.push(<div className="overflow-x-auto" key={`table-${index}`}><table><tbody>{rows.map((row, ri) => { const Cell = ri === 0 ? "th" : "td"; return <tr key={ri}>{row.map((cell, ci) => <Cell key={ci}>{inline(cell)}</Cell>)}</tr>; })}</tbody></table></div>);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)/);
    if (heading) { const H = heading[1].length <= 2 ? "h4" : "h5"; blocks.push(<H key={index}>{inline(heading[2])}</H>); index += 1; continue; }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []; while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) items.push(lines[index++].replace(/^\s*[-*]\s+/, ""));
      blocks.push(<ul key={`ul-${index}`}>{items.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul>); continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = []; while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) items.push(lines[index++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(<ol key={`ol-${index}`}>{items.map((item, i) => <li key={i}>{inline(item)}</li>)}</ol>); continue;
    }
    const paragraph = [line]; index += 1;
    while (index < lines.length && lines[index].trim() && !/^\s*(#{1,4}\s|\||[-*]\s|\d+[.)]\s)/.test(lines[index])) paragraph.push(lines[index++].trim());
    blocks.push(<p key={`p-${index}`}>{inline(paragraph.join(" "))}</p>);
  }
  return <div className="doc-section-content">{blocks}</div>;
}
