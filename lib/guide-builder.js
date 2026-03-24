import fs from 'node:fs';
import path from 'node:path';

export function buildDraftJson(outputType, words, raw) {
  return { output_type: outputType, words, raw };
}

export function writeDraftJson(sessionDir, outputType, words, raw) {
  const draft = buildDraftJson(outputType, words, raw);
  fs.writeFileSync(
    path.join(sessionDir, 'current-draft.json'),
    JSON.stringify(draft, null, 2),
    'utf-8'
  );
  return draft;
}

export function formatGuideUpdatePrompt(currentGuide, annotations, outputType = null) {
  const annotationLines = annotations.map((a) => {
    const action = a.action.toUpperCase();
    const comment = a.comment ? ` — ${a.comment}` : '';
    const replacement = a.replacement ? ` -> "${a.replacement}"` : '';
    return `  ${action}: "${a.text}"${comment}${replacement}`;
  });

  const outputTypeInstruction = outputType
    ? `\n   Also place structure and length preferences specific to "${outputType}" in the "Output-Type Rules: ${outputType}" section rather than general Structure Preferences.`
    : '';

  return `You are updating a writing style guide based on user feedback.

## CURRENT GUIDE

${currentGuide}

## ANNOTATIONS FROM THIS ROUND

${annotationLines.join('\n')}

## INSTRUCTIONS

Analyze the annotations above and update the writing guide. Rules:
1. Add new preferences discovered from the annotations
2. Reinforce existing preferences that are confirmed by annotations
3. Keep all existing preferences that are not contradicted
4. If an annotation contradicts an existing preference, update it and note the change
5. Confidence tracking: New preferences start at "low". If a preference was already present and is confirmed by new annotations, upgrade to "medium". Three or more sessions confirming: "high". Never downgrade without explicit contradiction
6. Examples: For recurring patterns (3+ annotations of the same type), generate paired good/bad examples in the Examples section using <example type="good"> and <example type="bad"> tags. Bad example shows the disliked pattern, good example shows the preferred alternative
7. Boundaries: If an annotation comment contains strong language ("always", "never", "must", "don't ever"), promote it to the Boundaries section — LIKE → "Always Do", DISLIKE → "Never Do"
8. Anti-Voice: If a pattern of dislikes emerges (e.g., multiple formal/stiff phrases disliked), add a concise anti-voice statement. Keep to 1-3 bullet points
9. Update YAML frontmatter: increment annotations count by ${annotations.length}, increment sessions by 1, set parent_version to current version number, then increment version${outputTypeInstruction}
10. Keep the guide under ~4000 tokens. Merge redundant rules. High-confidence preferences get examples; low-confidence get table entries only
11. Maintain the exact markdown format of the current guide (same sections, same table format)
12. Return ONLY the updated guide markdown, nothing else`;
}
