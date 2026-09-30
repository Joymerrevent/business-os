---
id: 20260929-01
title: シェル非依存
status: proposed
created: 2026-09-30
updated: 2026-09-30
as_of: n/a
verified: n/a
supersedes: n/a
---

# 20260929-01: シェル非依存

## 背景

器は Mac を主環境としつつ、Windows でも同一構成で動かす。将来は他人にも配布する。
Claude Code（CC）は Windows でネイティブ（PowerShell）でも WSL でも動くが、
両者で bash の有無・シンボリックリンクの挙動・パス表記が異なる。

2026 年 5 月版の器は bash の hook とシンボリックリンク（`.repos/`）に依存していた。
これは Mac 単独なら問題ないが、Windows ネイティブでは hook が動かず、
Obsidian 等の GUI アプリと WSL を組み合わせるとファイルシステム境界の問題が出る。

## 決定

1. hook と scripts は **TypeScript で書き、Node が直接実行する**。ビルドと `dist/` は持たない
   - Node 24 系を要求し、`.node-version` で固定する
   - tsconfig で `erasableSyntaxOnly` を有効にし、Node が剥がせない構文（`enum`、`namespace`、
     パラメータプロパティ、デコレータ）を tsc が弾く
2. **bash スクリプトを一切含めない**。Git のフック（pre-commit / pre-push）も Node 製で管理する
3. **シンボリックリンクを使わない**。実装リポへの参照は `docs/charter/repositories.md` に
   パスを書き、必要時に CC が `--add-dir` で読み込む。OS ごとのパス欄を持つ
4. パスは相対パス、改行は LF に固定（`.gitattributes`）
5. CI は Linux と Windows の両方で回す
6. Windows 利用者への案内は二段構え：WSL 推奨（Mac と完全同一手順）、ネイティブでも動作
   - ネイティブでは CC の sandbox が動かないため、防衛は三重になる（20260929-05）。WSL2 を推奨する理由の一つ

## 根拠

- CC 自体が Node.js 前提のため、Node は利用者の環境に必ずある。bash はそうではない
- 2026-09 時点で CC は PowerShell を主シェルとして扱う設定を持ち、Windows ネイティブ運用が現実的になった。
  bash 前提の hook はこの流れに逆行する
- シンボリックリンクは Windows で権限や開発者モードを要求し、モバイル同期ツールや Obsidian で
  事故が報告されている。設定ファイルによるパス参照で同じ目的を達成できる
- TS を Node で直接実行する方式は、TS の型の恩恵とビルド不要の単純さを両立する。
  Plugin として配布するときに利用者側でビルドが要らない
- 検討した代替案：
  - JS + JSDoc（ビルド不要だが型記述が冗長）→ TS 直接実行で同じ利点を得られるため不採用
  - TS + tsup で `dist/` を配る（porters-connect 方式）→ 生成物の追跡と一致検査が要り、
    hook の規模には過剰なため不採用

## 影響

- 利用者の環境要件が Node 24 以上になる。起動時セルフチェック（20260929-06）で確認し、
  満たさなければ明示的に止める
- `erasableSyntaxOnly` により書ける TS の範囲が狭まる。hook・scripts の規模では実害はない
- Node が TS を直接実行する挙動は 2025 年後半に安定化したものであり、**実装初日に
  Mac / Windows 双方で `node hooks/xxx.ts` が動くことを確認する**
- Windows の既定の推奨は WSL（防衛は四重、Obsidian なし）。GUI ツール（Obsidian 等）を使う場合の選択肢として、
  CC もネイティブで動かし、データを Windows 側に置く構成を案内する（WSL のファイルシステム境界問題を避ける）。
  この構成では第一層（sandbox）が無いことを利用者に明示する

## 参考

- Claude Code changelog（Windows PowerShell 主シェル対応、2026-09）
- Node.js の型剥がし（type stripping）：v22.18 / v23.6 以降で既定有効
- TypeScript 5.8 `erasableSyntaxOnly`
- 関連 ADR：20260929-06（セルフチェック）、20260929-10（Plugin 配布）
