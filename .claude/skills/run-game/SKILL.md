---
name: run-game
description: このプロジェクトのゲームを起動・確認・自動プレイ検証する手順。ゲームを動かして見たい、スクリーンショットを撮りたい、変更を実機相当で確認したい時に使う。
---

# ゲームの起動と確認

## 起動

```bash
npm start   # python3 -m http.server 8000 --bind 127.0.0.1
```

http://127.0.0.1:8000/ を開く。ビルド不要（静的 ES Modules）。
既にポート 8000 が使用中なら起動済み（`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/` が 200）。

## 自動プレイ検証（4画面サイズ・スクリーンショット付き）

初回のみ: `npm install --no-save playwright-core`（Chromium は `/opt/pw-browsers/chromium` に同梱）

```bash
node qa/drive.mjs                  # 4サイズ全部（~6分）
node qa/drive.mjs iphone-portrait  # 1サイズだけ（~90秒）
```

- 証跡: `docs/qa/shots/<label>-<step>.png`
- 終了コード 0 = 全チェック通過。ログに ok/FAIL が並ぶ。

## 状態の内部観察

ページ内で `window.__qa.state()`（シーン・水位・充填率・繊維数など）、
`window.__qa.targets()`（現在シーンのタッチ目標座標）が読める。読み取り専用。

## 構文チェックのみ

```bash
for f in src/*.js; do node --check "$f"; done
```
