# Fukidashi Studio 実装計画

作成日: 2026-07-09

## 参照した設計書

- `D:\SougouStartFolder\Fukidashi_Studio\md\Fukidashi_Studio_Codex設計書.md`

## 公式一次ソース確認メモ

- Tauri 2: https://v2.tauri.app/
  - `pnpm create tauri-app` などの作成経路が案内されている。
  - Windows開発には Microsoft C++ Build Tools、WebView2、Rust が必要。
- Tauri Dialog Plugin: https://v2.tauri.app/plugin/dialog/
  - 画像を開く、保存先を選ぶための file open/save dialog を使う。
- Vite: https://vite.dev/guide/
  - 現在の公式ドキュメント表示は v8.1.2。
- React: https://react.dev/
  - 現在の公式ドキュメント表示は v19.2。
- Fabric.js: https://fabricjs.com/
  - 公式サイト表示では latest release 7.0.0。
  - Canvas上のオブジェクト操作、テキスト編集、viewport zoom/pan が用途に合う。

## ローカル環境チェック

| 項目 | 結果 | 判定 |
|---|---:|---|
| Node.js | v24.14.1 | OK |
| pnpm | 11.7.0 | OK |
| Python | 3.12.10 | OK |
| rustc | 未検出 | Tauriビルド前に要対応 |
| cargo | 未検出 | Tauriビルド前に要対応 |
| git | 現在フォルダは未初期化 | CP1で初期化候補 |

## 配置方針

生成物はすべて `D:\SougouStartFolder\Fukidashi_Studio` 配下に置く。

初期作業では、現在書き込み可能な `D:\SougouStartFolder\Fukidashi_Studio\md` を作業ルートとして扱う。アプリ本体を親直下の `D:\SougouStartFolder\Fukidashi_Studio\fukidashi-studio` へ置く場合は、書き込み許可を取ってから作成する。

## 不明点・要対応

- Rust/Cargoが未導入のため、Tauriデスクトップ起動とビルドは現状ブロックされる。
- 依存パッケージのインストールにはネットワークアクセスが必要になる可能性がある。
- 吹き出しテンプレPNGはCP3以降で実素材が必要。CP1/CP2はダミー画像で進められる。
- ソースコードの最終ルートを `md` 配下にするか、親直下に別フォルダを作るかを実装開始前に確定する。

## 採用アーキテクチャ

基本レイヤー:

```text
React UI
  -> Editor Commands / UseCases
  -> FabricEditorAdapter + Project Store
  -> PlatformFileService
  -> Tauri plugins / Browser fallback
```

主要方針:

- ReactコンポーネントはTauri APIやFabricインスタンスを直接乱用しない。
- Fabric objectは実行時の編集表現、ProjectDocumentは保存可能な真実として扱う。
- Canvasの内部論理サイズは元画像サイズと一致させる。
- zoom / pan / fit はviewport変換であり、データ座標や書き出し寸法へ混ぜない。
- Undo/RedoはMVPではProjectDocumentの軽量スナップショット方式、最大50履歴。
- Python sidecarは常駐サーバーではなく、stdin/stdout JSONのCLIを基本にする。

## CP別実装計画

### CP1: 骨格と最小スモーク

目的:
- React + TypeScript + Vite のアプリ骨格を作る。
- Tauri 2設定を追加する。
- Python CLI `image_inspect` の最小応答を作る。
- ダミー画像、テキスト、PNG保存の最小経路を通す。

成果物:
- `package.json`
- `src/`
- `src-tauri/`
- `python/`
- `scripts/`
- `README.md`
- `STATUS.md`

受け入れ条件:
- Webモードで起動できる。
- Python CLIがJSONで画像メタデータまたは疎通応答を返す。
- Rust導入後にTauri起動確認へ進める構造になっている。

### CP2: Canvasコア

目的:
- Fabric.jsでベース画像を元サイズの論理キャンバスへ読み込む。
- Fit、zoom、panを実装する。
- ステータスバーに画像サイズ、倍率、選択種別を出す。

受け入れ条件:
- 852x1280、1022x1536、1122x1402、任意縦長画像でFit表示できる。
- 書き出しサイズが表示倍率に影響されない設計になっている。

### CP3: 吹き出しテンプレ

目的:
- PNG/WebPテンプレ登録、サムネイル表示、キャンバス追加、移動、拡縮、回転、反転。

受け入れ条件:
- 任意透明PNGを登録して再利用できる。
- 元ファイル削除後もアプリデータ上のコピーを参照できる構造。

### CP4: テキスト編集

目的:
- 縦書き/横書き、文字内容、フォント、サイズ、色、縁取り、揃え、行間、字間を即時反映。

受け入れ条件:
- 日本語IME入力で破綻しない。
- 下部または左下プロパティからプレビューへ即時反映される。

### CP5: 関連付け・レイヤー・Undo/Redo

目的:
- 吹き出しと文字のペア、レイヤー順、表示/ロック、主要操作履歴を作る。

受け入れ条件:
- 主要操作が最大50履歴内でUndo/Redoできる。

### CP6: 自動保存・復旧

目的:
- ProjectDocumentの保存、autosave、最近使った項目、復旧導線を作る。

受け入れ条件:
- 異常終了想定後に直前状態へ戻せる。

### CP7: 書き出し

目的:
- 元画像ピクセル寸法のPNG書き出し。
- ファイル名、保存先、品質設定の導線。

受け入れ条件:
- 書き出し画像の寸法が元画像と一致する。

### CP8: UI/UX仕上げ

目的:
- ダークテーマ、左操作/右プレビュー、左右反転、ショートカット、レスポンシブ基盤。

受け入れ条件:
- 反復操作がしやすく、古い業務ソフト風に見えない。

### CP9: 検証とWindowsビルド

目的:
- Vitest、必要ならReact Testing Library/Playwright。
- Python画像検証ツール。
- Windowsビルド。

受け入れ条件:
- 主要テストシナリオと別サイズ確認を通す。

### CP10: 納品物

目的:
- 利用手順書、最終レポート、検証結果を整える。

受け入れ条件:
- Chamiが手順書だけで起動・操作できる。

## CP1着手時の具体手順案

1. 作業ルートを確定する。
2. git初期化の可否を確認する。
3. `pnpm create tauri-app` か、Vite先行 + Tauri追加のどちらかで骨格を作る。
4. 依存を追加する: React、TypeScript、Vite、Fabric.js、Zustand、Tailwind、必要最小限のRadix、Vitest。
5. `python/src/cli.py` と `python/src/image_inspect.py` を作る。
6. Webモードの最小スモークを通す。
7. `STATUS.md` をCP1進行状態へ更新する。
