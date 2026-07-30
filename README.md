# Fukidashi Studio

縦長画像へ吹き出しテンプレ、文字、図形を重ね、高解像度PNGとして保存する画像編集アプリです。Windowsデスクトップ版と、iPhoneを含むWeb版に対応します。

## iPhoneで使う

GitHub Pagesの公開URLをSafariで開きます。

1. 「写真・ファイルから選ぶ」で元画像を開きます。
2. 画面下部の「追加」で吹き出し・文字・図形を追加します。
3. オブジェクトを選び、「調整」で文字や位置を編集します。
4. 上部の「画像を保存」を押し、共有メニューで「画像を保存」または「ファイルに保存」を選びます。

Safariの共有ボタンから「ホーム画面に追加」を選ぶと、アプリのように起動できます。一度読み込んだ後は、オフラインでも起動できるPWA構成です。画像と自動保存データは端末内で処理され、サーバーへ送信しません。

## 開発

```powershell
pnpm install
pnpm run dev
```

Tauriデスクトップ版の起動・ビルドにはRust / CargoとWindows C++ Build Toolsが必要です。Web版ではブラウザ内で主要編集フローが完結します。

## 検証

```powershell
pnpm run build
pnpm run test
pnpm run python:test
pnpm run python:smoke
```

## 配置

生成物は `D:\SougouStartFolder\Fukidashi_Studio` 配下に限定します。

`master`または`main`へpushすると、`.github/workflows/deploy-pages.yml`がWeb版をGitHub Pagesへ自動公開します。
