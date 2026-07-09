# STATUS - Fukidashi Studio

## 完了
- [x] 設計書 `Fukidashi_Studio_Codex設計書.md` を読み込み
- [x] 公式一次ソースの初期確認
- [x] ローカル前提ツールの初期確認
- [x] CP1: 事前チェック、Tauri骨格、Python環境、最小スモーク
- [x] CP2: Canvasコア、ベース画像読込、ズーム/パン
- [x] CP3: 吹き出しテンプレ登録・追加・変形
- [x] CP4: テキスト編集とインスペクター
- [x] CP5: ペア関連付け、レイヤー、Undo/Redo
- [x] CP6: 自動保存、復旧、プロジェクトJSON保存/読込
- [x] CP7: 書き出し、ファイル名、品質設定
- [x] CP8: UI/UX仕上げ、ショートカット、レスポンシブ基盤
- [x] CP10: 手順書、最終レポート
- [x] 一括検証 `docs/CHECK_REPORT.json` 生成

## 進行中
- [ ] CP9: Windows Tauriビルド（Rust/Cargo と Visual Studio C++ Build Tools 導入待ち）

## 未着手
- [ ] Tauri実機起動 `pnpm tauri dev`
- [ ] Windowsインストーラ生成 `pnpm tauri build`

## 次の一手
- Rust/rustup/Cargo と Visual Studio C++ Build Tools を導入後、`pnpm tauri info` を再確認する。
- その後 `pnpm tauri dev`、`pnpm tauri build` を実行する。
- Web確認は `pnpm run dev -- --port 5173` で `http://127.0.0.1:5173` を開く。

## 決定事項ログ
- 2026-07-09: MVPは設計書どおり Tauri 2 + React + TypeScript + Vite + Fabric.js を基本構成にする。
- 2026-07-09: Canvas内部サイズは読み込んだ元画像サイズと一致させ、表示倍率と書き出し解像度を分離する。
- 2026-07-09: オブジェクト座標は論理キャンバス基準で保存する。
- 2026-07-09: 外部API、CDN、クラウド画像送信はMVPで使わない。
- 2026-07-09: PythonはGUI本体ではなく、画像検査、fixture生成、差分検証、レポート生成の補助CLIとして使う。
- 2026-07-09: ローカル確認結果は Node.js v24.14.1、pnpm 11.7.0、Python 3.12.10。WebView2は検出済み。
- 2026-07-09: `pnpm tauri info` により Rust/Cargo/rustup と Visual Studio C++ Build Tools が未検出であることを確認。
- 2026-07-09: pnpm 11 のビルドスクリプト許可は `pnpm-workspace.yaml` の `allowBuilds` で管理する。
- 2026-07-09: SVGテンプレはMVP対象外。PNG/JPEG/WebPのみ対応する。
- 2026-07-09: `pnpm run build`、`pnpm run test`、`pnpm run python:test`、`pnpm run python:smoke` は成功。
