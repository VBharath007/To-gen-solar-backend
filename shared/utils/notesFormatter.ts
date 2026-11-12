/**
 * Utility to convert raw JSON notes or terms (e.g. from quotations or legacy invoice data)
 * into clean, beautifully formatted plain text.
 */
export function formatNotesToPlainText(rawNotes: string | null | undefined): string {
  if (!rawNotes || typeof rawNotes !== 'string') return '';
  const trimmed = rawNotes.trim();
  if (!trimmed) return '';

  // If it doesn't look like JSON, return as-is
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return '';

      // Format 1: Quotation payment terms array [{ key: "Prices", value: "Price quoted Ex-works" }, ...]
      const hasKeyValue = parsed.some(
        item => item && typeof item === 'object' && ('key' in item || 'title' in item || 'name' in item)
      );

      if (hasKeyValue) {
        return parsed
          .map(item => {
            if (!item || typeof item !== 'object') return String(item);
            const k = (item.key || item.title || item.name || '').trim();
            const v = (item.value || item.desc || item.description || item.val || '').trim();
            if (!k && !v) return '';
            if (!k) return v;
            if (!v) return k;
            if (v.includes('\n')) {
              const indented = v
                .split('\n')
                .map((line: string) => `  ${line}`)
                .join('\n');
              return `${k}:\n${indented}`;
            }
            return `${k}: ${v}`;
          })
          .filter(Boolean)
          .join('\n\n');
      }

      // Format 2: Milestones array [{ stage: "Advance", percentage: 20, terms/description: "..." }]
      const hasMilestones = parsed.some(
        item => item && typeof item === 'object' && ('stage' in item || 'percentage' in item)
      );

      if (hasMilestones) {
        return parsed
          .map((item, idx) => {
            const stage = item.stage || `Milestone ${idx + 1}`;
            const pct = item.percentage !== undefined && item.percentage !== null ? ` (${item.percentage}%)` : '';
            const desc = item.terms || item.description || '';
            return `${idx + 1}. ${stage}${pct}${desc ? `: ${desc}` : ''}`;
          })
          .filter(Boolean)
          .join('\n');
      }

      // Format 3: Array of strings or numbers
      if (parsed.every(item => typeof item === 'string' || typeof item === 'number')) {
        return parsed.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
      }

      // Format 4: Fallback array of general objects
      return parsed
        .map((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            return Object.entries(item)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
          }
          return `${idx + 1}. ${String(item)}`;
        })
        .join('\n');
    }

    // Format 5: Key-value plain object { "Prices": "...", ... }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('\n');
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}
