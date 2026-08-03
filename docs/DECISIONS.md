# DECISIONS — 重要な設計判断

## D1. Vite + TypeScript + 素の Canvas 2D(Phaser不採用)

- 本作の中核はレール高さ場の連続変形・火花プール・2種類の投影(横=側面 / 縦=奥行き)で、
  Phaser のシーン/スプライト抽象はほぼ使わず、むしろ物理・カメラ・入力の既定挙動を外す作業が増える。
- 素の Canvas 2D なら描画・入力・DPR・回転を完全制御でき、バンドルが小さく(依存ゼロ)、
  モバイル Safari での不確定要素が減る。
- 決定論的テスト(seed固定・状態機械を直接 import して vitest)も容易。
- Vite は dev server / build / 静的デプロイに最適。WebGL は本表現(線・矩形・粒子少数百)には過剰。

## D2. 明示的ステートマシン(単一ファイル src/game/states.ts)

title → arrive → scanBefore → prepUnits → lower → grind → scanAfter → testRun → replay → (arrive)。
遷移は `advance()` 系の明示 API のみ。無効入力は無視(壊れない)。テストは window.__railGameTest で観測。

## D3. レール = 1次元高さ場 (512サンプル / 100m)

波状摩耗は seeded PRNG (mulberry32) による2〜3正弦波+包絡線。削正は研削位置周辺で
高さ場を連続的に低エンベロープへ近づける(突然の差し替えなし)。粗さ RMS が音・揺れ・完了判定・
火花密度の共通ソース。

## D4. 縦横は「同じワールド、2つの投影」

- 横画面: 側面構図。車両を大きく、レール断面波形と火花を同時に見せる。
- 縦画面: 奥行き透視(消失点上方)。レール2本が奥へ収束、下部に大レバー。
- 回転はワールド状態に触れない(投影だけ切替)→ 削ったレールも状態も保持される。

## D5. 音は WebAudio 合成のみ(音声ファイルなし)

初回ユーザー操作で AudioContext を生成/resume。ガタガタ(帯域ノイズtick)、下降サーボ、
ガコン(低音サイン+金属ノイズ)、研削シャーッ(帯域ノイズ、接触×速度×粗さでゲイン)、
ミスト、スーッ、成功チャイムをノードで合成。ファイル資産ゼロで反復調整が速い。

## D6. 幼児入力は「単一ポインタ+意図推定」

最初の pointerdown だけ採用(追加指は無視)。当たり判定は最小 64px、主要操作 72–96px。
ドッキングは吸着半径を広く取り自動補正。3〜5秒無操作で非言語ヒント(手のアイコンがジェスチャを実演)。

## D7. Playwright は preinstall Chromium (executablePath)

環境の chromium-1194 と @playwright/test 1.62 の revision(1234)が不一致のため、
`launchOptions.executablePath = '/opt/pw-browsers/chromium'` を明示。ブラウザ再DLはしない。

## D8. repo-recon subagent は不使用

着手時点のリポジトリは README 9バイトのみの空構成で、調査対象が存在しないため。
