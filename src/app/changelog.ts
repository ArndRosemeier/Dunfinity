/** CHANGELOG.md as data: one release per merge (v0.001, v0.002, ...), for the What's new panel. Pure, so tests run it. */

export interface Release {
  /** "v0.010" */
  version: string;
  title: string;
  /** The bullet points, as written (Markdown). */
  notes: string[];
}

/** The releases in CHANGELOG.md, newest first (as written there). */
export function parseChangelog(md: string): Release[] {
  const out: Release[] = [];
  for (const line of md.split('\n')) {
    const head = /^## (v[\d.]+)\s*[—–-]\s*(.*)$/.exec(line);
    if (head) { out.push({ version: head[1], title: head[2].trim(), notes: [] }); continue; }
    const cur = out[out.length - 1];
    if (!cur) continue;
    if (/^\s*- /.test(line)) cur.notes.push(line.replace(/^\s*- /, ''));
    else if (line.trim() && cur.notes.length) cur.notes[cur.notes.length - 1] += ' ' + line.trim(); // a wrapped bullet
  }
  return out;
}

/** A bullet's Markdown (`code`, **bold**) as safe HTML. */
export function noteHtml(md: string): string {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}
