(() => {
  const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const safeUrl = value => /^(https?:\/\/|mailto:)/i.test(String(value || '').trim()) ? String(value).trim() : '';
  const inline = value => escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+[^)]*)?\)/g, (_, alt, url) => safeUrl(url) ? `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy">` : alt)
    .replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+[^)]*)?\)/g, (_, text, url) => safeUrl(url) ? `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${text}</a>` : text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(item => item.trim());
  const tableDivider = line => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

  function render(markdown) {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const output = []; let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      if (/^```/.test(line)) {
        const language = line.slice(3).trim(); const block = []; index += 1;
        while (index < lines.length && !/^```/.test(lines[index])) { block.push(lines[index]); index += 1; }
        if (index < lines.length) index += 1;
        output.push(`<pre><code class="language-${escapeHtml(language)}">${escapeHtml(block.join('\n'))}</code></pre>`); continue;
      }
      if (index + 1 < lines.length && line.includes('|') && tableDivider(lines[index + 1])) {
        const header = cells(line), rows = []; index += 2;
        while (index < lines.length && lines[index].includes('|') && lines[index].trim()) { rows.push(cells(lines[index])); index += 1; }
        output.push(`<div class="markdown-table-wrap"><table><thead><tr>${header.map(item => `<th>${inline(item)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${header.map((_, column) => `<td>${inline(row[column] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
      }
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) { const level = heading[1].length; output.push(`<h${level}>${inline(heading[2])}</h${level}>`); index += 1; continue; }
      if (/^---+$/.test(line.trim())) { output.push('<hr>'); index += 1; continue; }
      if (/^>\s?/.test(line)) { const quote = []; while (index < lines.length && /^>\s?/.test(lines[index])) { quote.push(lines[index].replace(/^>\s?/, '')); index += 1; } output.push(`<blockquote>${render(quote.join('\n'))}</blockquote>`); continue; }
      const unordered = line.match(/^[-*+]\s+(.+)$/), ordered = line.match(/^\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        const tag = ordered ? 'ol' : 'ul', items = [];
        while (index < lines.length) {
          const match = lines[index].match(ordered ? /^\d+[.)]\s+(.+)$/ : /^[-*+]\s+(.+)$/); if (!match) break;
          const task = match[1].match(/^\[([ xX])\]\s+(.+)$/);
          items.push(`<li${task ? ' class="task-item"' : ''}>${task ? `<span>${task[1].toLowerCase() === 'x' ? '☑' : '☐'}</span> ${inline(task[2])}` : inline(match[1])}</li>`); index += 1;
        }
        output.push(`<${tag}>${items.join('')}</${tag}>`); continue;
      }
      const paragraph = [line]; index += 1;
      while (index < lines.length && lines[index].trim() && !/^```|^#{1,6}\s+|^>\s?|^[-*+]\s+|^\d+[.)]\s+|^---+$/.test(lines[index]) && !(lines[index].includes('|') && tableDivider(lines[index + 1] || ''))) { paragraph.push(lines[index]); index += 1; }
      output.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
    }
    return output.join('');
  }
  window.PRACTICE_MARKDOWN = { render };
})();
