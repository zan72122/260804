# レールけずりでんしゃ — Rail Grinder Night Work

4歳児向け・iPhone/iPad Safari ブラウザゲーム(垂直スライス)。
詳細は docs/ を参照: GAME_VISION / ACCEPTANCE / DECISIONS / EVIDENCE_LEDGER /
PLAYTEST_LOG / RAIL_DOMAIN_NOTES。

## 起動入口

- 開発: `npm run dev` → http://localhost:5173 (Vite, port 5173 固定)
- 検査: `npm run typecheck` / `npm test` (vitest) / `npm run test:e2e` (Playwright)
- ビルド: `npm run build` (tsc --noEmit + vite build → dist/)
- Playwright はプリインストール Chromium を `executablePath:
  /opt/pw-browsers/chromium` で使用。`playwright install` を実行しない。

## 毎回守る不変条件

1. ループは title→arrive→scanBefore→prepUnits→lower→grind→scanAfter→testRun→replay→arrive のみ。遷移は `src/game/states.ts` の表が唯一の真実。
2. 削正ユニットがロック(ガコン)する前に火花を出さない。
3. レール変形は削正車の位置と同期して連続的に行う。完成形への差し替え禁止。
4. 幼児UX: 一指操作のみ・主要タッチ対象≥64px・制限時間/採点/エラー表示/破壊なし。
5. 回転はワールド状態に触れない(投影の切替のみ)。音声グラフも再生成しない。
6. `window.__railGameTest` はテスト観測専用。画面へデバッグUIを出さない。
7. テストを削除・skip・弱体化して通すことを禁止。
8. MVP外機能(ステージ追加・通貨・経営・アンロック等)を足さない。

## 禁止事項

- ゲーム中核を DOM ボタンで実装しない(Canvas 2D が中核)
- 音声ファイル追加不要(WebAudio 合成のみ)
- バックエンド/ログイン/広告/分析/課金の導入
- 全画面の高速点滅・連続ストロボ表現
