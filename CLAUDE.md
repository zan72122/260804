# ふわっ！すうっ！かみの修復室

4歳児向け・リーフキャスティング（漉きはめ）による紙資料修復ゲーム。

## 起動

```
npm start        # = python3 -m http.server 8000 --bind 127.0.0.1
```

ブラウザで http://127.0.0.1:8000/ を開く。ビルド工程なし（静的 ES Modules + Canvas 2D、外部依存・外部アセットなし）。

自動検証: `node qa/drive.mjs [iphone-portrait|iphone-landscape|ipad-portrait|ipad-landscape]`
（要: `npm install --no-save playwright-core`、Chromium は `/opt/pw-browsers/chromium`）

## 体験憲法（変えないこと）

- 看板体験は「ふわっ（繊維の分散）」「すうっ（吸引で繊維が欠損へ集まる）」「ぴたり（輪郭に沿って膜が閉じる）」「ひらり（乾いた紙をめくる）」。特に「すうっ」が最優先。
- 因果を守る: 紙のある場所は水を通しにくく、欠損部で水が下へ抜け、その流れが繊維を運ぶ。
- 失われた文字・絵はゲーム内で決して再生成しない。修復されるのは紙の支持体だけ。
- 完成画像への瞬間差し替え禁止。充填は粒子の堆積で連続的に進む。
- 操作はタップ / 大きな一方向スワイプ / 太いなぞり / 寛容なドラッグのみ。文字・数値・制限時間・失敗・点数・星評価は使わない。
- 迷った子への誘導は視覚（ハンド・輪・揺れ）と短い音で行い、文章を足さない。
- 画面回転で繊維・水位・充填率・工程を失わない（モデルはレイアウト非依存）。

## 構成

- `src/paper.js` — 紙モデル（損傷マスク・図版・堆積層）。図版は損傷でパンチされ再生成されない。
- `src/fibers.js` — 繊維パーティクル（撹拌場・吸引流・沈着）。
- `src/scenes_*.js` — 各工程シーン。`src/main.js` — 入力・ループ・回転・QAフック `window.__qa`。
- ドキュメント: `docs/PRODUCT.md` `docs/LEAFCASTING.md` `docs/ACCEPTANCE.md` `docs/QA-EVIDENCE.md`
