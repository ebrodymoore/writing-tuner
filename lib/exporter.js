/**
 * Exports writing guides into agent-consumable formats.
 * Strips internal metadata (frontmatter, session history, sample provenance)
 * to produce clean instruction documents.
 */

export function parseYamlFrontmatter(guideContent) {
  const match = guideContent.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    // Strip quotes
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    // Parse types
    if (value === 'null') { result[key] = null; }
    else if (value === 'true') { result[key] = true; }
    else if (value === 'false') { result[key] = false; }
    else if (/^\d+$/.test(value)) { result[key] = parseInt(value, 10); }
    else { result[key] = value; }
  }
  return result;
}

function stripForExport(guideContent) {
  // Strip YAML frontmatter
  let content = guideContent.replace(/^---\n[\s\S]*?\n---\n*/, '');

  // Strip Session History section (last section, goes to end)
  content = content.replace(/\n## Session History[\s\S]*$/, '');

  // Strip Learned from Samples section
  content = content.replace(/\n## Learned from Samples[\s\S]*?(?=\n## |\n*$)/, '');

  return content.trim();
}

export function exportSystemPrompt(guideContent) {
  const content = stripForExport(guideContent);
  return `<writing-style>\n${content}\n</writing-style>`;
}

export function exportClaudeMd(guideContent) {
  const content = stripForExport(guideContent);
  return `# Writing Style Guide\n\nWhen generating any written content, follow these rules:\n\n${content}`;
}
