// hook の判定の記録。company/.claude/hook-log-YYYYMM.jsonl に 1 行ずつ追記する（gitignore）。
// 記録は観測のためのもので、防衛ではない。書けなくても判定は変えず、標準エラーに知らせるだけにする
// （書き込みの可否は軽い点検が毎セッション確かめる）。
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type LogEntry = {
  tool: string;
  decision: "deny" | "ask" | "allow";
  reason: string;
  target: string;
};

export const logFileName = (date: Date): string =>
  `hook-log-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}.jsonl`;

export const appendLog = (root: string, entry: LogEntry): void => {
  const now = new Date();
  try {
    const dir = join(root, ".claude");
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      join(dir, logFileName(now)),
      `${JSON.stringify({ at: now.toISOString(), ...entry })}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `business-os: hook の記録を書けませんでした（判定には影響しません）: ${String(error)}\n`,
    );
  }
};
