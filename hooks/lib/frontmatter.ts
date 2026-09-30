// フロントマターの読み取りと、Edit 後の内容の組み立て。
// 配布物は外部の依存を持てないため、YAML は「キー: 値」の範囲だけを読む（日付は文字列のまま）。

export type Frontmatter = {
  data: Record<string, string>;
  /** `---` から `---` までの生の文字列 */
  block: string;
};

const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_-]*):(?:[ \t]+(.*))?$/;

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  // 引用符の外の「 #」以降はコメント
  const comment = trimmed.search(/\s#/);
  return (comment >= 0 ? trimmed.slice(0, comment) : trimmed).trim();
};

/**
 * 先頭のフロントマターを読む。無ければ undefined。
 * 同じキーが 2 回出たら例外（どちらが正しいか決められないため）。
 */
export const parseFrontmatter = (text: string): Frontmatter | undefined => {
  const normalized = text.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) return undefined;
  const end = normalized.indexOf("\n---", 3);
  if (end < 0) return undefined;
  const after = normalized.slice(end + 4, end + 5);
  if (after !== "" && after !== "\n") return undefined;
  const block = normalized.slice(4, end);
  const data: Record<string, string> = {};
  let lastKey: string | undefined;
  for (const line of block.split("\n")) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    // 前のキーに続く一覧や入れ子（Obsidian のプロパティ等）は値として扱わない
    if (/^\s/.test(line) || line.startsWith("- ")) {
      if (lastKey === undefined) {
        throw new Error(`フロントマターを読めません: ${line}`);
      }
      data[lastKey] = "[list]";
      continue;
    }
    const match = KEY_LINE.exec(line);
    if (!match) throw new Error(`フロントマターを読めません: ${line}`);
    const key = match[1] ?? "";
    if (key in data)
      throw new Error(`フロントマターのキーが重複しています: ${key}`);
    data[key] = unquote(match[2] ?? "");
    lastKey = key;
  }
  return { data, block };
};

export type EditSpec = {
  old_string: string;
  new_string: string;
  replace_all?: boolean;
};

/** Edit を適用した後の内容を返す。Edit ツール自体が失敗する条件（見つからない・一意でない）なら undefined */
export const applyEdits = (
  current: string,
  edits: EditSpec[],
): string | undefined => {
  let text = current;
  for (const edit of edits) {
    const { old_string: oldString, new_string: newString } = edit;
    if (oldString === "") return undefined;
    const index = text.indexOf(oldString);
    if (index < 0) return undefined;
    if (edit.replace_all === true) {
      text = text.split(oldString).join(newString);
      continue;
    }
    if (text.indexOf(oldString, index + 1) >= 0) return undefined;
    text =
      text.slice(0, index) + newString + text.slice(index + oldString.length);
  }
  return text;
};

const FRONTMATTER_KEY =
  /^\s*(type|business|status|created|updated|as_of|verified|id|target)\s*:/;

/** old_string がフロントマターの範囲に触れていそうか（区切り線か、規約のキーを含む） */
export const touchesFrontmatter = (oldString: string): boolean =>
  oldString
    .replaceAll("\r\n", "\n")
    .split("\n")
    .some((line) => line.trim() === "---" || FRONTMATTER_KEY.test(line));
