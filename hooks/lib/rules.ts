// 分解したコマンドの意味を判定する。拒否（deny）は取り消せない操作、確認（ask）は大きく消す操作。
// 書き方ではなく意味（force か否か、再帰的に消すか否か）で判定する。
import { REDIRECT, type SimpleCommand } from "./shell.ts";

export type Verdict = { decision: "deny" | "ask"; reason: string } | undefined;

const basename = (name: string): string => {
  const parts = name.split(/[\\/]/);
  return (parts[parts.length - 1] ?? name).replace(/\.exe$/i, "").toLowerCase();
};

/** git のグローバルオプション（サブコマンドの前）のうち、値を次の引数にとるもの */
const GIT_GLOBAL_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--exec-path",
  "--config-env",
]);

/** サブコマンドごとの、値をとる短いオプション（`-m msg` の msg を別の旗と読まないため） */
const SHORT_WITH_VALUE: Record<string, string> = {
  push: "o",
  commit: "mFcCt",
  clean: "e",
  branch: "tu",
  reset: "",
};
const LONG_WITH_VALUE: Record<string, Set<string>> = {
  commit: new Set([
    "--message",
    "--file",
    "--reuse-message",
    "--reedit-message",
    "--template",
    "--author",
    "--date",
  ]),
  push: new Set(["--push-option", "--repo", "--receive-pack", "--exec"]),
};

type ParsedArgs = {
  shortFlags: Set<string>;
  longFlags: string[];
  positionals: string[];
};

const parseArgs = (args: string[], subcommand: string): ParsedArgs => {
  const shortFlags = new Set<string>();
  const longFlags: string[] = [];
  const positionals: string[] = [];
  const valueTakers = SHORT_WITH_VALUE[subcommand] ?? "";
  const longValueTakers = LONG_WITH_VALUE[subcommand] ?? new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "--") {
      positionals.push(...args.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      longFlags.push(arg);
      if (!arg.includes("=") && longValueTakers.has(arg)) i++;
      continue;
    }
    if (arg.startsWith("-") && arg.length > 1) {
      for (let k = 1; k < arg.length; k++) {
        const flag = arg[k] ?? "";
        shortFlags.add(flag);
        if (valueTakers.includes(flag)) {
          if (k === arg.length - 1) i++;
          break;
        }
      }
      continue;
    }
    positionals.push(arg);
  }
  return { shortFlags, longFlags, positionals };
};

const judgeGit = (argv: SimpleCommand): Verdict => {
  let i = 1;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (!arg.startsWith("-")) break;
    i += GIT_GLOBAL_WITH_VALUE.has(arg) ? 2 : 1;
  }
  const subcommand = argv[i];
  if (subcommand === undefined) return undefined;
  const { shortFlags, longFlags, positionals } = parseArgs(
    argv.slice(i + 1),
    subcommand,
  );
  const hasLong = (name: string) =>
    longFlags.some((flag) => flag === name || flag.startsWith(`${name}=`));

  if (subcommand === "push") {
    if (
      shortFlags.has("f") ||
      hasLong("--force") ||
      hasLong("--force-with-lease") ||
      hasLong("--force-if-includes")
    ) {
      return { decision: "deny", reason: "force push は禁止されています" };
    }
    if (positionals.some((arg) => arg.startsWith("+"))) {
      return {
        decision: "deny",
        reason: "`+` 付きの refspec（force push と同じ）は禁止されています",
      };
    }
    if (hasLong("--no-verify")) {
      return {
        decision: "deny",
        reason: "--no-verify で git のフックを飛ばすことは禁止されています",
      };
    }
  }
  if (
    subcommand === "commit" &&
    (shortFlags.has("n") || hasLong("--no-verify"))
  ) {
    return {
      decision: "deny",
      reason: "--no-verify で git のフックを飛ばすことは禁止されています",
    };
  }
  if (subcommand === "reset" && hasLong("--hard")) {
    return {
      decision: "ask",
      reason: "git reset --hard は未コミットの変更を消します",
    };
  }
  if (subcommand === "clean" && (shortFlags.has("f") || hasLong("--force"))) {
    return {
      decision: "ask",
      reason: "git clean -f は追跡されていないファイルを消します",
    };
  }
  if (
    subcommand === "branch" &&
    (shortFlags.has("D") ||
      ((shortFlags.has("d") || hasLong("--delete")) &&
        (shortFlags.has("f") || hasLong("--force"))))
  ) {
    return {
      decision: "ask",
      reason: "git branch -D はマージされていないブランチも消します",
    };
  }
  return undefined;
};

const judgeRm = (argv: SimpleCommand): Verdict => {
  for (const arg of argv.slice(1)) {
    if (arg === "--") break;
    if (
      arg === "--recursive" ||
      (/^-[a-zA-Z]+$/.test(arg) && /[rR]/.test(arg))
    ) {
      return { decision: "ask", reason: "再帰的な削除（rm -r）です" };
    }
  }
  return undefined;
};

const POWERSHELL_REMOVE = new Set([
  "remove-item",
  "rm",
  "ri",
  "del",
  "rd",
  "rmdir",
  "erase",
]);

const judgePowerShellRemove = (argv: SimpleCommand): Verdict =>
  argv.slice(1).some((arg) => /^-r/i.test(arg))
    ? { decision: "ask", reason: "再帰的な削除（Remove-Item -Recurse）です" }
    : undefined;

/** 判定に使う周辺の情報。isDocsPath は、引数のパスが docs/ 配下の文書かを返す */
export type JudgeContext = { isDocsPath: (path: string) => boolean };

const DOCS_BY_SHELL: Verdict = {
  decision: "ask",
  reason:
    "シェルのコマンドで docs/ の文書を書き換えようとしています。フロントマターの検査を通すため、Write / Edit ツールで書いてください",
};

/** sed -i・tee・リダイレクト・Set-Content などで docs/ の文書に書く操作 */
const judgeDocsWrite = (
  argv: SimpleCommand,
  name: string,
  dialect: "sh" | "pwsh",
  context: JudgeContext,
): Verdict => {
  const args = argv.slice(1);
  const touchesDocs = args.some((arg) => context.isDocsPath(arg));
  if (argv[0] === REDIRECT) return touchesDocs ? DOCS_BY_SHELL : undefined;
  if (!touchesDocs) return undefined;
  if (name === "sed" || name === "perl") {
    const inPlace = args.some(
      (arg) =>
        arg === "--in-place" ||
        arg.startsWith("--in-place=") ||
        /^-[a-zA-Z]*i/.test(arg),
    );
    return inPlace ? DOCS_BY_SHELL : undefined;
  }
  if (name === "tee") return DOCS_BY_SHELL;
  if (
    dialect === "pwsh" &&
    [
      "set-content",
      "add-content",
      "out-file",
      "sc",
      "ac",
      "new-item",
      "ni",
    ].includes(name)
  ) {
    return DOCS_BY_SHELL;
  }
  return undefined;
};

/** 全コマンドを判定し、最も強い結果を返す（deny > ask） */
export const judgeCommands = (
  commands: SimpleCommand[],
  dialect: "sh" | "pwsh",
  context: JudgeContext = { isDocsPath: () => false },
): Verdict => {
  let ask: Verdict;
  for (const argv of commands) {
    const name = basename(argv[0] ?? "");
    let verdict: Verdict;
    if (name === "git") verdict = judgeGit(argv);
    else if (dialect === "pwsh" && POWERSHELL_REMOVE.has(name))
      verdict = judgePowerShellRemove(argv);
    else if (name === "rm") verdict = judgeRm(argv);
    verdict ??= judgeDocsWrite(argv, name, dialect, context);
    if (verdict?.decision === "deny") return verdict;
    if (verdict?.decision === "ask" && ask === undefined) ask = verdict;
  }
  return ask;
};
