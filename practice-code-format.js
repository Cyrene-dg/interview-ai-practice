/* 只处理人工确认的 24 道源码题与 2 道终端文本题，避免误伤普通题目。 */
(() => {
  const specs = {
    'java-u57fa-7840-8bed-6cd5-28': { language: 'java', start: 'public class Square' },
    'java-u57fa-7840-8bed-6cd5-29': { language: 'java', start: 'public class EqualsMethod' },
    'java-u57fa-7840-8bed-6cd5-81': { language: 'java', start: 'public class Test{' },
    'java-u57fa-7840-8bed-6cd5-82': { language: 'java', start: 'byte b1=1,b2=2,b3,b6;' },
    'java-u57fa-7840-8bed-6cd5-84': { language: 'java', start: 'class CompareReference' },
    'java-u57fa-7840-8bed-6cd5-87': { language: 'java', start: 'public class SendValue' },
    'java-u57fa-7840-8bed-6cd5-111': { language: 'java', start: 'public class TestIncr' },
    'java-u9762-5411-5bf9-8c61-21': { language: 'java', start: 'public class HelloB extends HelloA' },
    'java-u9762-5411-5bf9-8c61-22': { language: 'java', start: 'class Base' },
    'java-u9762-5411-5bf9-8c61-61': { language: 'java', start: 'public class Demo' },
    'java-u9762-5411-5bf9-8c61-93': { language: 'java', start: 'class A' },
    'java-u9762-5411-5bf9-8c61-104': { language: 'java', start: 'class HelloA' },
    'java-u9762-5411-5bf9-8c61-123': { language: 'java', start: 'class Base' },
    'java-u5f02-5e38-5904-7406-3': { language: 'java', start: 'public class TestDemo' },
    'java-u5f02-5e38-5904-7406-5': { language: 'java', start: 'public class Test' },
    'java-u5f02-5e38-5904-7406-21': { language: 'java', start: 'public static int func' },
    'java-u96c6-5408-20': { language: 'java', start: 'Iterator it = list.iterator();' },
    'java-u96c6-5408-58': { language: 'java', start: 'public class Test{' },
    'database-mysql-7': { language: 'sql', start: 'CREATE TABLE student_table' },
    'database-mysql-34': { language: 'sql', start: 'select * from test where a = 1 and b = 2；', end: '； 在只建立一个联合索引' },
    'database-mysql-41': { language: 'sql', start: 'CREATE TABLE testTable' },
    'database-mysql-161': { language: 'sql', start: 'CREATE TABLE `student_table`' },
    'backend-linux-142': { language: 'c', start: 'int main(int argc, char* argv[])' },
    'backend-linux-203': { language: 'c', start: 'void main()' },
    'backend-linux-3': { language: 'terminal', start: 'root:x:0:0:root:/root:/bin/bash' },
    'backend-linux-260': { language: 'terminal', start: 'eth0\tLink encap:Ethernet' }
  };
  const labels = { java: 'Java', sql: 'SQL', c: 'C / Unix', terminal: '终端输出' };
  const keywordSets = {
    java: new Set('abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while String Integer Object List Set Map'.split(' ')),
    sql: new Set('SELECT FROM WHERE AND OR INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP PRIMARY KEY UNIQUE KEY INDEX JOIN LEFT RIGHT INNER ON GROUP BY ORDER ASC DESC LIMIT ENGINE DEFAULT CHARSET NOT NULL AUTO_INCREMENT COMMENT'.split(' ')),
    c: new Set('int char void long short float double return if else for while do switch case break continue struct typedef const static unsigned signed main'.split(' '))
  };

  const isWord = value => /[A-Za-z_]/.test(value || '');
  function highlighted(line, language, escape) {
    if (language === 'terminal') return escape(line);
    const keywords = keywordSets[language] || new Set();
    let result = '', index = 0;
    const token = /\/\/.*$|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b/g;
    for (const match of line.matchAll(token)) {
      result += escape(line.slice(index, match.index));
      const value = match[0];
      const className = value.startsWith('//') || value.startsWith('/*') ? 'comment' : value.startsWith('"') || value.startsWith("'") ? 'string' : keywords.has(value) ? 'keyword' : /^\d/.test(value) ? 'number' : '';
      result += className ? `<span class="token-${className}">${escape(value)}</span>` : escape(value);
      index = match.index + value.length;
    }
    return result + escape(line.slice(index));
  }
  function codeWithoutStrings(line) {
    let result = '', quote = '', escaped = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '/' && line[index + 1] === '/') break;
      result += char;
    }
    return result;
  }
  function normalizeStructuredLine(line) {
    return line.trim()
      .replace(/}\s*(catch|finally|else)\b/g, '} $1')
      .replace(/\b(if|for|while|switch|catch)\s*\(/g, '$1 (')
      .replace(/\b(try|finally|else|do)\s*\{/g, '$1 {')
      .replace(/\)\s*\{/g, ') {')
      .replace(/\s+;/g, ';');
  }
  function formatStructuredCode(code) {
    const prepared = [];
    for (const rawLine of code.split('\n')) {
      const line = normalizeStructuredLine(rawLine);
      if (line === '{' && prepared.length && prepared[prepared.length - 1].trim() && !prepared[prepared.length - 1].trim().endsWith('{')) {
        prepared[prepared.length - 1] = `${prepared[prepared.length - 1].trimEnd()} {`;
      } else prepared.push(line);
    }
    let level = 0;
    return prepared.map(line => {
      if (!line) return '';
      const structure = codeWithoutStrings(line);
      const opens = (structure.match(/{/g) || []).length;
      const closes = (structure.match(/}/g) || []).length;
      const indentation = Math.max(0, level - (structure.trimStart().startsWith('}') ? 1 : 0));
      level = Math.max(0, level + opens - closes);
      return `${'  '.repeat(indentation)}${line}`;
    });
  }
  function renderCodeLines(lines, language, escape) {
    return lines.map(line => `<li><code>${highlighted(line, language, escape) || ' '}</code></li>`).join('');
  }
  function formatFill(question, escape) {
    const fill = question.codeFill;
    if (!fill?.template || !Array.isArray(fill.blanks)) return null;
    const language = fill.language || 'Java';
    const blankMap = new Map(fill.blanks.map(blank => [String(blank.id), blank]));
    const lines = formatStructuredCode(String(fill.template));
    const lineHtml = lines.map(line => {
      const parts = line.split(/(\[\[[A-Za-z0-9_-]+\]\])/g);
      const html = parts.map(part => {
        const match = /^\[\[([A-Za-z0-9_-]+)\]\]$/.exec(part);
        if (!match) return highlighted(part, language.toLowerCase(), escape);
        const blank = blankMap.get(match[1]);
        if (!blank) return escape(part);
        return `<input class="code-blank-input" data-fill-id="${escape(match[1])}" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${escape(blank.label || '填空')}" aria-label="填空 ${escape(blank.label || '')}">`;
      }).join('');
      return `<li><code>${html || ' '}</code></li>`;
    }).join('');
    const referenceLines = formatStructuredCode(String(fill.reference || fill.template));
    const reference = `<details class="reference-code"><summary>查看完整参考代码</summary><figure class="code-card code-${escape(language.toLowerCase())}"><figcaption><span class="code-language">${escape(language)}</span><span class="code-caption">参考代码</span><button class="copy-code" type="button">复制代码</button></figcaption><div class="code-scroll"><ol class="code-lines">${renderCodeLines(referenceLines, language.toLowerCase(), escape)}</ol></div></figure></details>`;
    return {
      html: `<figure class="code-card code-fill-card code-${escape(language.toLowerCase())}"><figcaption><span class="code-language">${escape(language)}</span><span class="code-caption">题目代码 · 补全标有序号的空位</span><button class="copy-code" type="button">复制代码</button></figcaption><div class="code-scroll"><ol class="code-lines">${lineHtml}</ol></div></figure>`,
      reference,
      blanks: fill.blanks,
    };
  }
  function format(question, escape) {
    const spec = specs[question.id];
    if (!spec) return null;
    const source = String(question.content || '');
    const startIndex = source.indexOf(spec.start);
    if (startIndex < 0) return null;
    let endIndex = source.length, suffix = '';
    if (spec.end) {
      const markerIndex = source.indexOf(spec.end, startIndex);
      if (markerIndex >= 0) {
        endIndex = markerIndex + 1;
        suffix = source.slice(markerIndex + 1).trim();
      }
    }
    const prompt = [source.slice(0, startIndex).trim(), suffix].filter(Boolean).join(' ');
    const code = source.slice(startIndex, endIndex).trim();
    if (!code) return null;
    const lines = ['java', 'c'].includes(spec.language) ? formatStructuredCode(code) : code.split('\n');
    const lineHtml = renderCodeLines(lines, spec.language, escape);
    return {
      prompt,
      html: `<figure class="code-card code-${spec.language}"><figcaption><span class="code-language">${labels[spec.language]}</span><span class="code-caption">题目代码</span><button class="copy-code" type="button">复制代码</button></figcaption><div class="code-scroll"><ol class="code-lines">${lineHtml}</ol></div></figure>`
    };
  }
  window.PRACTICE_CODE_FORMAT = { format, formatFill, specs };
})();
