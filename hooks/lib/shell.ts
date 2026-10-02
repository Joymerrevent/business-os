// シェルのコマンド文字列を、単純コマンド（引数の配列）の並びに分解する。
// 目的は「意味の判定」であり、実行ではない。書き方の違い（フラグの位置、引用符、
// `sh -c` / `eval` / コマンド置換の内側）を吸収して、同じ意味を同じ形にそろえる。
// 読めない入力（閉じていない引用符など）は例外にして、呼び出し側が fail-closed に扱う。

export type SimpleCommand = string[];

/**
 * 出力のリダイレクト（`> file` `>> file`）の書き込み先を表す擬似コマンドの名前。
 * `[REDIRECT, "<書き込み先>"]` の形で、分解結果の末尾に足す。
 */
export const REDIRECT = "__redirect__";

/** リダイレクト記号の後ろを読み、書き込み先の語が続くなら true を返す（`>&2` などの複製は false） */
const readRedirect = (
  src: string,
  start: number,
): { next: number; hasTarget: boolean } => {
  let i = start + 1;
  if (src[i] === ">" || src[i] === "|") i++;
  if (src[i] === "&") {
    i++;
    while (/[0-9-]/.test(src[i] ?? "")) i++;
    return { next: i, hasTarget: false };
  }
  return { next: i, hasTarget: true };
};

const MAX_DEPTH = 8;
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
const WRAPPERS = new Set([
  "sudo",
  "env",
  "command",
  "exec",
  "nohup",
  "time",
  "nice",
  "xargs",
]);

const basename = (name: string): string => {
  const parts = name.split(/[\\/]/);
  return (parts[parts.length - 1] ?? name).replace(/\.exe$/i, "");
};

/** 閉じ括弧の位置を探す（引用符の内側は数えない） */
const findClosingParen = (src: string, start: number): number => {
  let depth = 1;
  let quote: string | undefined;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\" && quote === '"') i++;
      else if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "\\") i++;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error("コマンド置換の括弧が閉じていません");
};

/** POSIX 系シェル（sh / bash / zsh）の文字列を分解する */
export const parseShell = (src: string, depth = 0): SimpleCommand[] => {
  if (depth > MAX_DEPTH) throw new Error("コマンドの入れ子が深すぎます");
  const commands: SimpleCommand[] = [];
  let argv: string[] = [];
  let word: string | undefined;
  const heredocs: { delimiter: string; stripTabs: boolean }[] = [];

  const redirects: SimpleCommand[] = [];
  let redirectNext = false;
  const endWord = () => {
    if (word !== undefined) {
      if (redirectNext) redirects.push([REDIRECT, word]);
      else argv.push(word);
      redirectNext = false;
    }
    word = undefined;
  };
  const endCommand = () => {
    endWord();
    redirectNext = false;
    if (argv.length > 0) commands.push(argv);
    argv = [];
  };
  // 入れ子（コマンド置換）は展開済みの結果を別に集める（二重に展開しないため）
  const inner: SimpleCommand[] = [];
  const nested = (text: string) => {
    inner.push(...parseShell(text, depth + 1));
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i] ?? "";
    const next = src[i + 1] ?? "";
    if (ch === "\n") {
      endCommand();
      i++;
      // ヒアドキュメントの本文は読み飛ばす（中身はコマンドではない）
      for (const doc of heredocs.splice(0)) {
        for (;;) {
          if (i >= src.length) break;
          const lineEnd = src.indexOf("\n", i);
          const line = src.slice(i, lineEnd < 0 ? src.length : lineEnd);
          i = lineEnd < 0 ? src.length : lineEnd + 1;
          const compared = doc.stripTabs ? line.replace(/^\t+/, "") : line;
          if (compared === doc.delimiter) break;
        }
      }
      continue;
    }
    if (ch === " " || ch === "\t") {
      endWord();
      i++;
      continue;
    }
    if (ch === "#" && word === undefined) {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (";&|(){}".includes(ch)) {
      endCommand();
      i++;
      continue;
    }
    if (ch === "<" && next === "<" && src[i + 2] !== "<") {
      endWord();
      i += 2;
      let stripTabs = false;
      if (src[i] === "-") {
        stripTabs = true;
        i++;
      }
      while (src[i] === " " || src[i] === "\t") i++;
      let delimiter = "";
      while (i < src.length && !/[\s;&|<>()]/.test(src[i] ?? "")) {
        const c = src[i] ?? "";
        if (c !== "'" && c !== '"' && c !== "\\") delimiter += c;
        i++;
      }
      if (delimiter === "")
        throw new Error("ヒアドキュメントの区切りがありません");
      heredocs.push({ delimiter, stripTabs });
      continue;
    }
    if (ch === ">") {
      // `2>` の 2 のようなファイル記述子の番号は引数にしない
      if (word !== undefined && /^\d+$/.test(word)) word = undefined;
      endWord();
      const redirect = readRedirect(src, i);
      redirectNext = redirect.hasTarget;
      i = redirect.next;
      continue;
    }
    if (ch === "<") {
      endWord();
      i++;
      continue;
    }
    if (ch === "\\") {
      if (next !== "\n") word = (word ?? "") + next;
      i += 2;
      continue;
    }
    if (ch === "'") {
      const close = src.indexOf("'", i + 1);
      if (close < 0) throw new Error("引用符（'）が閉じていません");
      word = (word ?? "") + src.slice(i + 1, close);
      i = close + 1;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let text = "";
      for (;;) {
        if (j >= src.length) throw new Error('引用符（"）が閉じていません');
        const c = src[j] ?? "";
        if (c === '"') break;
        if (c === "\\" && '"\\$`\n'.includes(src[j + 1] ?? "")) {
          text += src[j + 1] ?? "";
          j += 2;
          continue;
        }
        if (c === "$" && src[j + 1] === "(") {
          const close = findClosingParen(src, j + 2);
          nested(src.slice(j + 2, close));
          j = close + 1;
          continue;
        }
        if (c === "`") {
          const close = src.indexOf("`", j + 1);
          if (close < 0) throw new Error("バッククォートが閉じていません");
          nested(src.slice(j + 1, close));
          j = close + 1;
          continue;
        }
        text += c;
        j++;
      }
      word = (word ?? "") + text;
      i = j + 1;
      continue;
    }
    if (ch === "$" && next === "(") {
      const close = findClosingParen(src, i + 2);
      nested(src.slice(i + 2, close));
      word = word ?? "";
      i = close + 1;
      continue;
    }
    if (ch === "`") {
      const close = src.indexOf("`", i + 1);
      if (close < 0) throw new Error("バッククォートが閉じていません");
      nested(src.slice(i + 1, close));
      word = word ?? "";
      i = close + 1;
      continue;
    }
    word = (word ?? "") + ch;
    i++;
  }
  endCommand();
  return [...expand(commands, depth, "sh"), ...inner, ...redirects];
};

/** PowerShell の文字列を分解する */
export const parsePowerShell = (src: string, depth = 0): SimpleCommand[] => {
  if (depth > MAX_DEPTH) throw new Error("コマンドの入れ子が深すぎます");
  const commands: SimpleCommand[] = [];
  let argv: string[] = [];
  let word: string | undefined;
  const redirects: SimpleCommand[] = [];
  let redirectNext = false;
  const endWord = () => {
    if (word !== undefined) {
      if (redirectNext) redirects.push([REDIRECT, word]);
      else argv.push(word);
      redirectNext = false;
    }
    word = undefined;
  };
  const endCommand = () => {
    endWord();
    redirectNext = false;
    if (argv.length > 0) commands.push(argv);
    argv = [];
  };
  const inner: SimpleCommand[] = [];
  const nested = (text: string) => {
    inner.push(...parsePowerShell(text, depth + 1));
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i] ?? "";
    const next = src[i + 1] ?? "";
    if (ch === " " || ch === "\t") {
      endWord();
      i++;
      continue;
    }
    if (ch === "#" && word === undefined) {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if ("\n;|{}()".includes(ch) || (ch === "&" && next === "&")) {
      endCommand();
      i += ch === "&" ? 2 : 1;
      continue;
    }
    if (ch === ">") {
      // `2>` `*>` の番号や * は引数にしない
      if (word !== undefined && /^(\d+|\*)$/.test(word)) word = undefined;
      endWord();
      const redirect = readRedirect(src, i);
      redirectNext = redirect.hasTarget;
      i = redirect.next;
      continue;
    }
    if (ch === "&" && word === undefined) {
      // 呼び出し演算子（& cmd）
      i++;
      continue;
    }
    if (ch === "`") {
      word = (word ?? "") + next;
      i += 2;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      let text = "";
      for (;;) {
        if (j >= src.length) throw new Error("引用符（'）が閉じていません");
        if (src[j] === "'" && src[j + 1] === "'") {
          text += "'";
          j += 2;
          continue;
        }
        if (src[j] === "'") break;
        text += src[j] ?? "";
        j++;
      }
      word = (word ?? "") + text;
      i = j + 1;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let text = "";
      for (;;) {
        if (j >= src.length) throw new Error('引用符（"）が閉じていません');
        const c = src[j] ?? "";
        if (c === '"') break;
        if (c === "`") {
          text += src[j + 1] ?? "";
          j += 2;
          continue;
        }
        if (c === "$" && src[j + 1] === "(") {
          const close = findClosingParen(src, j + 2);
          nested(src.slice(j + 2, close));
          j = close + 1;
          continue;
        }
        text += c;
        j++;
      }
      word = (word ?? "") + text;
      i = j + 1;
      continue;
    }
    if (ch === "$" && next === "(") {
      const close = findClosingParen(src, i + 2);
      nested(src.slice(i + 2, close));
      word = word ?? "";
      i = close + 1;
      continue;
    }
    word = (word ?? "") + ch;
    i++;
  }
  endCommand();
  return [...expand(commands, depth, "pwsh"), ...inner, ...redirects];
};

/** 前置きの変数代入やラッパーを外し、`sh -c` `eval` などの内側を展開する */
const expand = (
  commands: SimpleCommand[],
  depth: number,
  dialect: "sh" | "pwsh",
): SimpleCommand[] => {
  const result: SimpleCommand[] = [];
  for (const original of commands) {
    let argv = [...original];
    for (;;) {
      const head = argv[0];
      if (head === undefined) break;
      if (dialect === "sh" && /^[A-Za-z_][A-Za-z0-9_]*=/.test(head)) {
        argv = argv.slice(1);
        continue;
      }
      if (WRAPPERS.has(basename(head))) {
        argv = argv.slice(1);
        while (
          argv[0] !== undefined &&
          (argv[0].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0]))
        ) {
          argv = argv.slice(1);
        }
        continue;
      }
      break;
    }
    const head = argv[0];
    if (head === undefined) continue;
    const name = basename(head).toLowerCase();

    if (SHELLS.has(name)) {
      const index = argv.findIndex(
        (arg, k) => k > 0 && /^-[a-zA-Z]*c[a-zA-Z]*$/.test(arg),
      );
      const script = index > 0 ? argv[index + 1] : undefined;
      if (script !== undefined) result.push(...parseShell(script, depth + 1));
      result.push(argv);
      continue;
    }
    if (name === "eval") {
      result.push(...parseShell(argv.slice(1).join(" "), depth + 1));
      continue;
    }
    if (name === "pwsh" || name === "powershell") {
      const index = argv.findIndex(
        (arg, k) => k > 0 && /^-c(o(m(m(a(n(d)?)?)?)?)?)?$/i.test(arg),
      );
      if (index > 0) {
        result.push(
          ...parsePowerShell(argv.slice(index + 1).join(" "), depth + 1),
        );
      }
      const encoded = argv.findIndex(
        (arg, k) =>
          k > 0 &&
          /^-e(n(c(o(d(e(d(c(o(m(m(a(n(d)?)?)?)?)?)?)?)?)?)?)?)?)?$/i.test(arg),
      );
      const payload = encoded > 0 ? argv[encoded + 1] : undefined;
      if (payload !== undefined) {
        result.push(
          ...parsePowerShell(
            Buffer.from(payload, "base64").toString("utf16le"),
            depth + 1,
          ),
        );
      }
      result.push(argv);
      continue;
    }
    if (
      dialect === "pwsh" &&
      (name === "invoke-expression" || name === "iex")
    ) {
      result.push(...parsePowerShell(argv.slice(1).join(" "), depth + 1));
      continue;
    }
    if (name === "cmd") {
      const index = argv.findIndex((arg, k) => k > 0 && /^\/[ck]$/i.test(arg));
      if (index > 0) {
        result.push(
          ...parsePowerShell(argv.slice(index + 1).join(" "), depth + 1),
        );
      }
      result.push(argv);
      continue;
    }
    result.push(argv);
  }
  return result;
};
