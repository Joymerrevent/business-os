// company の見つけ方と状態の読み取り。company は `.business-os.json` を持つディレクトリ。
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const MARKER = ".business-os.json";

export type CompanyState = "initializing" | "active";

export type Company = {
  root: string;
  state: CompanyState;
  pluginVersion: string | undefined;
};

/**
 * cwd から上位へ辿り、`.business-os.json` のあるディレクトリを返す。
 * git リポのルート（`.git` のあるディレクトリ）で探索を止める。見つからなければ undefined（company ではない）。
 */
export const findCompanyRoot = (cwd: string): string | undefined => {
  let dir = resolve(cwd);
  for (;;) {
    if (existsSync(join(dir, MARKER))) return dir;
    if (existsSync(join(dir, ".git"))) return undefined;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
};

/** `.business-os.json` を読む。壊れていれば例外（呼び出し側が fail-closed に扱う） */
export const readCompany = (root: string): Company => {
  const raw: unknown = JSON.parse(readFileSync(join(root, MARKER), "utf8"));
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${MARKER} の中身がオブジェクトではありません`);
  }
  const data = raw as Record<string, unknown>;
  const state = data["state"];
  if (state !== "initializing" && state !== "active") {
    throw new Error(`${MARKER} の state が不明です: ${String(state)}`);
  }
  const version = data["pluginVersion"];
  return {
    root,
    state,
    pluginVersion: typeof version === "string" ? version : undefined,
  };
};

/**
 * company のルートからの相対パスを、比較用の形（区切りは /、小文字）で返す。
 * 大文字小文字を区別しないファイルシステムで保護を回避されないよう、常に小文字で比べる。
 * company の外なら undefined。
 */
export const relativeKey = (
  root: string,
  filePath: string,
): string | undefined => {
  const rel = relative(root, resolve(root, filePath));
  if (
    rel === "" ||
    rel === ".." ||
    rel.startsWith(`..${sep}`) ||
    isAbsolute(rel)
  ) {
    return undefined;
  }
  return rel.split(sep).join("/").toLowerCase();
};

/** 提案の target を比較用の形にする */
export const normalizeTarget = (target: string): string => {
  const parts: string[] = [];
  for (const part of target.replaceAll("\\", "/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/").toLowerCase();
};

/** 保護対象：憲章、地図、防衛設定、器の状態 */
export const isProtected = (key: string): boolean =>
  key === "claude.md" ||
  key === ".claude/settings.json" ||
  key === MARKER ||
  key.startsWith("docs/charter/");

/**
 * 雛形の置き場（Obsidian のテンプレート）。置き換え記号（{{date}} など）を含むため、
 * フロントマターの検査の対象外にする
 */
export const TEMPLATES_DIR = "docs/_templates/";

/** フロントマター検査の対象：docs/ 配下の Markdown（雛形の置き場を除く） */
export const needsFrontmatter = (key: string): boolean =>
  key.startsWith("docs/") &&
  key.endsWith(".md") &&
  !key.startsWith(TEMPLATES_DIR);
