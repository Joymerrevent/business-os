import { describe, expect, it } from "vitest";
import {
  applyEdits,
  parseFrontmatter,
  touchesFrontmatter,
} from "../../plugin/hooks/lib/frontmatter.ts";

describe("parseFrontmatter", () => {
  it("キーと値を文字列として読む（日付も文字列のまま）", () => {
    const fm = parseFrontmatter(
      "---\ncreated: 2026-10-01\nas_of: n/a\n---\n# x\n",
    );
    expect(fm?.data).toEqual({ created: "2026-10-01", as_of: "n/a" });
  });

  it("CRLF と BOM を受け付ける", () => {
    const fm = parseFrontmatter("\uFEFF---\r\ntype: daily\r\n---\r\n");
    expect(fm?.data).toEqual({ type: "daily" });
  });

  it("引用符とコメントを外す", () => {
    const fm = parseFrontmatter(
      "---\na: \"x # y\"\nb: 'z'\nc: v # note\n---\n",
    );
    expect(fm?.data).toEqual({ a: "x # y", b: "z", c: "v" });
  });

  it("空の値は空文字", () => {
    expect(parseFrontmatter("---\nas_of:\n---\n")?.data).toEqual({ as_of: "" });
  });

  it("一覧（Obsidian のプロパティ等）は値として扱わない", () => {
    const fm = parseFrontmatter("---\ntags:\n  - a\n  - b\ntype: daily\n---\n");
    expect(fm?.data).toEqual({ tags: "[list]", type: "daily" });
  });

  it("フロントマターが無ければ undefined", () => {
    expect(parseFrontmatter("# 見出し\n")).toBeUndefined();
    expect(parseFrontmatter("---\ntype: daily\n")).toBeUndefined();
    expect(parseFrontmatter("---\ntype: daily\n----\n")).toBeUndefined();
  });

  it("重複したキーと読めない行は例外", () => {
    expect(() => parseFrontmatter("---\na: 1\na: 2\n---\n")).toThrow("重複");
    expect(() => parseFrontmatter("---\n: x\n---\n")).toThrow("読めません");
  });
});

describe("applyEdits", () => {
  it("一意な置換を適用する", () => {
    expect(applyEdits("a b c", [{ old_string: "b", new_string: "B" }])).toBe(
      "a B c",
    );
  });

  it("見つからない・一意でない・空の old_string は undefined（Edit 自体が失敗する）", () => {
    expect(
      applyEdits("a", [{ old_string: "x", new_string: "y" }]),
    ).toBeUndefined();
    expect(
      applyEdits("a a", [{ old_string: "a", new_string: "b" }]),
    ).toBeUndefined();
    expect(
      applyEdits("a", [{ old_string: "", new_string: "b" }]),
    ).toBeUndefined();
  });

  it("replace_all と複数の編集", () => {
    expect(
      applyEdits("a a", [
        { old_string: "a", new_string: "b", replace_all: true },
      ]),
    ).toBe("b b");
    expect(
      applyEdits("x y", [
        { old_string: "x", new_string: "1" },
        { old_string: "y", new_string: "2" },
      ]),
    ).toBe("1 2");
  });
});

describe("touchesFrontmatter", () => {
  it("区切り線か規約のキーを含めば true", () => {
    expect(touchesFrontmatter("---")).toBe(true);
    expect(touchesFrontmatter("status: draft")).toBe(true);
    expect(touchesFrontmatter("本文\nverified: n/a")).toBe(true);
    expect(touchesFrontmatter("本文だけ")).toBe(false);
  });
});
