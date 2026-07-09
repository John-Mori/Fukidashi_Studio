# Fukidashi Studio 利用手順

## インストールして使う

生成済みインストーラ:

```text
D:\SougouStartFolder\Fukidashi_Studio\md\src-tauri\target\release\bundle\nsis\Fukidashi Studio_0.1.0_x64-setup.exe
D:\SougouStartFolder\Fukidashi_Studio\md\src-tauri\target\release\bundle\msi\Fukidashi Studio_0.1.0_x64_en-US.msi
```

通常はNSIS版の `Fukidashi Studio_0.1.0_x64-setup.exe` を使います。

直接起動する場合:

```text
D:\SougouStartFolder\Fukidashi_Studio\md\src-tauri\target\release\fukidashi-studio.exe
```

## 開発モードで起動

```powershell
cd D:\SougouStartFolder\Fukidashi_Studio\md
pnpm run dev -- --port 5173
```

ブラウザで `http://127.0.0.1:5173` を開きます。

## 基本フロー

1. `Open` でベース画像を開く、画面へ画像をドロップする、またはコピー中の画像を `Ctrl+V` で貼り付けます。
2. `Template` で吹き出しテンプレPNG/JPEG/WebPを追加します。
3. 左パネルの吹き出しサムネイルを押すとキャンバスへ追加されます。
4. ツールバーからテキスト、四角形、楕円、直線を追加できます。
5. 下部プロパティで位置、拡縮、回転、文字内容、色、縁取り、図形サイズを調整します。
6. テキスト選択時は `Link bubble` で最寄りの吹き出しへリンクし、`Center pair` で中央寄せできます。
7. マウスホイールでズーム、Fitボタンで全体表示、Panツールで移動できます。
8. `Export` で元画像と同じピクセル寸法のPNGを書き出します。

## 保存と復旧

- `Save` は `.fukidashi.json` としてプロジェクトを保存します。
- `Project` で保存したJSONを再読込できます。
- 編集中の状態はブラウザ/Tauri WebViewのlocalStorageへ自動保存されます。
- 起動時に自動保存がある場合は復旧ボタンが表示されます。

## ビルド

```powershell
cd D:\SougouStartFolder\Fukidashi_Studio\md
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
pnpm tauri build
```

## 検証

```powershell
pnpm run build
pnpm run test
pnpm run python:test
pnpm run python:smoke
python scripts/test_all.py
pnpm tauri info
pnpm tauri build
```
