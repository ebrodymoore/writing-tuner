import fs from 'node:fs';
import path from 'node:path';

export function buildDraftJson(outputType, segments, raw) {
  return { output_type: outputType, segments, raw };
}

export function writeDraftJson(sessionDir, outputType, segments, raw) {
  const draft = buildDraftJson(outputType, segments, raw);
  fs.writeFileSync(
    path.join(sessionDir, 'current-draft.json'),
    JSON.stringify(draft, null, 2),
    'utf-8'
  );
  return draft;
}

export function formatGuideUpdatePrompt(currentGuide, annotations) {
  const annotationLines = annotations.map((a) => {
    const action = a.action.toUpperCase();
    const comment = a.comment ? ` — ${a.comment}` : '';
    const replacement = a.replacement ? ` -> "${a.replacement}"` : '';
    return `  ${action}: "${a.text}"${comment}${replacement}`;
  });

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
5. Keep the guide under ~2000 tokens. Merge redundant rules if needed.
6. Maintain the exact markdown format of the current guide (same sections, same table format)
7. Update the annotation count in the header
8. Return ONLY the updated guide markdown, nothing else`;
}
