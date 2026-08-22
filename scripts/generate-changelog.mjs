import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Bakes the git history into public/data/changelog.json so the PC dashboard
 * can show what changed and when. Runs of identical messages (the Notion
 * content syncs) collapse into one row with a count, and conventional
 * prefixes become short tags.
 */

const OUTPUT_FILE = path.resolve("public/data/changelog.json");
const LIMIT = 60;
const KEEP = 14;

const TAGS = [
  [/^(feat|add)/i, "ADD"],
  [/^(fix|hotfix)/i, "FIX"],
  [/^(chore|build|ci)/i, "SYNC"],
  [/^(refactor|style|perf)/i, "TUNE"],
  [/^docs?/i, "DOC"],
];

function tagFor(subject) {
  for (const [re, tag] of TAGS) if (re.test(subject)) return tag;
  return "EDIT";
}

/** Drops the conventional-commit prefix — the tag already carries it. */
function clean(subject) {
  return subject.replace(/^[a-z]+(\([^)]*\))?:\s*/i, "").trim();
}

function readLog() {
  try {
    return execSync(`git log -${LIMIT} --pretty=format:%h\x1f%ad\x1f%s --date=short`, {
      encoding: "utf-8",
    })
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, date, subject] = line.split("\x1f");
        return { hash, date, subject };
      });
  } catch {
    console.warn("[changelog] git log unavailable, writing empty changelog");
    return [];
  }
}

const entries = [];
for (const commit of readLog()) {
  const text = clean(commit.subject);
  const last = entries[entries.length - 1];
  // fold a run of the same message into one row
  if (last && last.text === text) {
    last.count += 1;
    last.since = commit.date; // oldest date in the run
    continue;
  }
  entries.push({
    hash: commit.hash,
    date: commit.date,
    tag: tagFor(commit.subject),
    text,
    count: 1,
  });
}

const trimmed = entries.slice(0, KEEP);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(trimmed, null, 2) + "\n");
console.log(`[changelog] ${trimmed.length} entries written`);
