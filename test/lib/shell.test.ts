import { describe, expect, it } from "vitest";
import { parsePowerShell, parseShell } from "../../hooks/lib/shell.ts";

describe("parseShell", () => {
  it("区切り（; && || | 改行）でコマンドを分ける", () => {
    expect(parseShell("a 1; b 2 && c || d | e\nf")).toEqual([
      ["a", "1"],
      ["b", "2"],
      ["c"],
      ["d"],
      ["e"],
      ["f"],
    ]);
  });

  it("引用符とエスケープを解く", () => {
    expect(parseShell(`echo 'a b' "c \\"d\\"" e\\ f`)).toEqual([
      ["echo", "a b", 'c "d"', "e f"],
    ]);
  });

  it("引用符の内側の文字列はコマンドにしない", () => {
    expect(parseShell('echo "git push -f; rm -rf /"')).toEqual([
      ["echo", "git push -f; rm -rf /"],
    ]);
  });

  it("sh -c と eval の内側を展開する", () => {
    expect(parseShell("sh -c 'git push -f'")).toContainEqual([
      "git",
      "push",
      "-f",
    ]);
    expect(parseShell("bash -lc 'git push -f'")).toContainEqual([
      "git",
      "push",
      "-f",
    ]);
    expect(parseShell("eval git push -f")).toContainEqual([
      "git",
      "push",
      "-f",
    ]);
  });

  it("コマンド置換の内側を展開する", () => {
    expect(parseShell("echo $(git push -f)")).toContainEqual([
      "git",
      "push",
      "-f",
    ]);
    expect(parseShell('echo "x $(git push -f)"')).toContainEqual([
      "git",
      "push",
      "-f",
    ]);
    expect(parseShell("echo `git push -f`")).toContainEqual([
      "git",
      "push",
      "-f",
    ]);
  });

  it("変数代入とラッパーを外す", () => {
    expect(parseShell("A=1 B=2 sudo -E env C=3 git push")).toEqual([
      ["git", "push"],
    ]);
  });

  it("ヒアドキュメントの本文はコマンドにしない", () => {
    const src =
      "git commit -F - <<'EOF'\ngit push -f と書いた本文\nEOF\ngit status";
    expect(parseShell(src)).toEqual([
      ["git", "commit", "-F", "-"],
      ["git", "status"],
    ]);
  });

  it("コメントを読み飛ばす", () => {
    expect(parseShell("git status # git push -f")).toEqual([["git", "status"]]);
  });

  it("閉じていない引用符は例外（fail-closed）", () => {
    expect(() => parseShell("echo 'abc")).toThrow();
    expect(() => parseShell('echo "abc')).toThrow();
    expect(() => parseShell("echo $(abc")).toThrow();
  });

  it("入れ子が深すぎると例外", () => {
    let src = "git status";
    for (let i = 0; i < 12; i++) src = `sh -c ${JSON.stringify(src)}`;
    expect(() => parseShell(src)).toThrow("深すぎ");
  });
});

describe("parsePowerShell", () => {
  it("区切りと引用符", () => {
    expect(parsePowerShell("git status; echo 'a ''b'''")).toEqual([
      ["git", "status"],
      ["echo", "a 'b'"],
    ]);
  });

  it("バッククォートのエスケープ", () => {
    expect(parsePowerShell('echo "a`"b"')).toEqual([["echo", 'a"b']]);
  });

  it("pwsh -Command と Invoke-Expression の内側を展開する", () => {
    expect(parsePowerShell('pwsh -Command "git push -f"')).toContainEqual([
      "git",
      "push",
      "-f",
    ]);
    expect(parsePowerShell("iex 'git push -f'")).toContainEqual([
      "git",
      "push",
      "-f",
    ]);
  });

  it("-EncodedCommand を解読して展開する", () => {
    const encoded = Buffer.from("git push -f", "utf16le").toString("base64");
    expect(
      parsePowerShell(`powershell -EncodedCommand ${encoded}`),
    ).toContainEqual(["git", "push", "-f"]);
  });
});
