# Fukidashi Studio 利用手順

## 起動

```powershell
cd D:\SougouStartFolder\Fukidashi_Studio\md
pnpm install
pnpm run dev -- --port 5173
```

ブラウザで `http://127.0.0.1:5173` を開きます。

## 基本フロー

1. `Open` でベース画像を開く、または画面へ画像をドロップします。
2. `Template` で吹き出しテンプレPNG/JPEG/WebPを追加します。
3. 左パネルの吹き出しサムネイルを押すとキャンバスへ追加されます。
4. ツールバーからテキスト、四角形、楕円、直線を追加できます。
5. 下部プロパティで位置、拡縮、回転、文字内容、色、縁取り、図形サイズを調整します。
6. マウスホイールでズーム、Fitボタンで全体表示、Panツールで移動できます。
7. `Export` で元画像と同じピクセル寸法のPNGを書き出します。

## 保存と復旧

- `Save` は `.fukidashi.json` としてプロジェクトを保存します。
- `Project` で保存したJSONを再読込できます。
- 編集中の状態はブラウザのlocalStorageへ自動保存されます。
- 起動時に自動保存がある場合は復旧ボタンが表示されます。

## デスクトップ版ビルド前提

Tauri版の起動・ビルドには以下が必要です。

- Microsoft C++ Build Tools（Desktop development with C++）
- Rust / rustup / Cargo
- WebView2 Runtime（現在の環境では検出済み）

確認コマンド:

```powershell
pnpm tauri info
```

## 検証

```powershell
pnpm run build
pnpm run test
pnpm run python:test
pnpm run python:smoke
```

一括チェック:

```powershell
python scripts/test_all.py
```
