# Fukidashi Studio 利用手順

## インストールして使う

生成済みインストーラ:

```text
D:\SougouStartFolder\Fukidashi_Studio\src-tauri\target\release\bundle\nsis\Fukidashi Studio_0.1.0_x64-setup.exe
D:\SougouStartFolder\Fukidashi_Studio\src-tauri\target\release\bundle\msi\Fukidashi Studio_0.1.0_x64_en-US.msi
```

通常はNSIS版の `Fukidashi Studio_0.1.0_x64-setup.exe` を使います。

直接起動する場合:

```text
D:\SougouStartFolder\Fukidashi_Studio\Fukidashi Studio.lnk
```

## 開発モードで起動

```powershell
cd D:\SougouStartFolder\Fukidashi_Studio
pnpm run dev -- --port 5173
```

ブラウザで `http://127.0.0.1:5173` を開きます。

## 基本フロー

1. `画像` でベース画像を開く、画面へ画像をドロップする、またはコピー中の画像を `Ctrl+V` で貼り付けます。
2. `テンプレ` で吹き出しテンプレPNG/JPEG/WebPを追加します。
3. 左パネルの吹き出しサムネイルを押すとキャンバスへ追加されます。
4. ツールバーからテキスト、縦長四角、楕円、直線を追加できます。
5. 四角または吹き出しを選択し、下部の `枠内文字` に入力すると、文字が枠内へ自動配置されます。
6. `余白を整える` で、文字の上下左右の余白を同じ感覚に再調整できます。
7. 吹き出しを選択して `内側白・外側透過` を押すと、黒線を枠として内側を白、外側を透明にしたPNGへ整えます。
8. 下部プロパティで位置、拡縮、回転、文字内容、色、フチ、図形サイズを調整します。
9. `書き出し` で元画像と同じピクセル寸法のPNGを書き出します。

## 保存と復旧

- `保存` は `.fukidashi.json` としてプロジェクトを保存します。
- `プロジェクト` で保存したJSONを再読込できます。
- 編集中の状態はブラウザ/Tauri WebViewのlocalStorageへ自動保存されます。
- 起動時に自動保存がある場合は復旧ボタンが表示されます。

## ビルド

```powershell
cd D:\SougouStartFolder\Fukidashi_Studio
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
