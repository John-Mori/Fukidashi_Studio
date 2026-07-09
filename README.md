# Fukidashi Studio

読み込んだ画像へ吹き出しテンプレ、テキスト、図形を重ねて元画像サイズのPNGを書き出すローカル完結アプリです。

## 開発

```powershell
pnpm install
pnpm run dev
```

Tauriデスクトップ版の起動・ビルドには Rust / Cargo と Windows C++ Build Tools が必要です。Webモードではブラウザ内のファイル選択とダウンロードで主要編集フローを確認できます。

## 検証

```powershell
pnpm run build
pnpm run test
pnpm run python:test
pnpm run python:smoke
```

## 配置

生成物は `D:\SougouStartFolder\Fukidashi_Studio` 配下に限定します。
