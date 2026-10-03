#!/usr/bin/env node
// 署名のケースの偽の署名プログラム（ADR 20261003-13）。作業場所の git の gpg.ssh.program に設定する。
// git は `<プログラム> -Y sign -n git -f <鍵> <対象のファイル>` を呼び、`<対象>.sig` を読む。
// 進行役が開いた試験のソケット（git config の eval.agentSocket）に接続できたときだけ署名を書く。
// 接続できなければ、1Password の SSH agent と同じく「Could not connect to socket」を含む文言で失敗する。
// 1Password などが無い開発機でも、sandbox がソケットへの接続を許すかどうかだけで成否が決まる。
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { connect } from "node:net";

const SIGNATURE = [
  "-----BEGIN SSH SIGNATURE-----",
  "ZXZhbC1mYWtlLXNpZ25hdHVyZQ==",
  "-----END SSH SIGNATURE-----",
  "",
].join("\n");

const fail = (message: string): never => {
  process.stderr.write(`fake-signer: ${message}\n`);
  process.exit(1);
};

const target = process.argv.at(-1);
if (process.argv[2] !== "-Y" || process.argv[3] !== "sign" || !target) {
  fail(
    `署名（-Y sign）以外の呼び出しには対応していません：${process.argv.slice(2).join(" ")}`,
  );
}
const config = spawnSync("git", ["config", "--get", "eval.agentSocket"], {
  encoding: "utf8",
});
const socket = config.stdout.trim();
if (config.status !== 0 || socket === "") {
  fail("git config の eval.agentSocket がありません");
}
const client = connect(socket);
client.on("data", () => {
  writeFileSync(`${String(target)}.sig`, SIGNATURE);
  client.end();
  process.exit(0);
});
client.on("error", (error) => {
  fail(`Could not connect to socket: ${error.message}`);
});
