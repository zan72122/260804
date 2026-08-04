# EVIDENCE_LEDGER — 完成条件と証拠

最終更新: 2026-08-04。確認方法の詳細は docs/ACCEPTANCE.md。
「最新結果」はすべて実際に実行したコマンド/ブラウザ操作の結果。

| ID | 条件 | 確認方法 | 最新結果 | 証拠 |
|----|------|----------|----------|------|
| A1 | 一周できる | E2E full-loop(実ポインタ操作) | PASS (4/4寸法) | artifacts/playtest/*/01〜11*.png, tests/e2e/full-loop.spec.ts |
| A2 | 4寸法で一周 | Playwright projects 390×844/844×390/820×1180/1180×820 | PASS 11/11 tests | 同上(寸法別ディレクトリ) |
| A3 | 回転で状態保持 | E2E rotation(phone/tablet両対) + unit test | PASS | artifacts/playtest/rotation-{iphone,ipad}/ |
| A4 | console error 0 | 全E2Eで console+pageerror 収集し assert [] | PASS(favicon 404 は修正済) | tests/e2e/helpers.ts expectNoErrors |
| A5 | スキャン前後で形状が明瞭に異なる | E2E: rmsAfter < 40% initial + screenshot | PASS(実測 ~9割減) | artifacts/playtest/*/07-scan-after-overlay.png |
| A6 | 接触前は火花ゼロ | E2E+unit: lower完了前 sparkCount===0 | PASS | tests/e2e/full-loop.spec.ts, tests/unit/game-flow.test.ts |
| A7 | 車位置とレール変形の同期 | E2E: 研削中、前方未通過域のRMS不変 / unit: grindAt局所性 | PASS | full-loop.spec.ts grind-mid-sync + artifacts/playtest/*/06-grind-mid-sync.png |
| A8 | 前後の音と揺れの差 | E2E: arrive中 max shake>0.5、testRun中 whoosh>0.25 かつ bob<0.8 | PASS(wheelNoiseバグ修正後) | full-loop.spec.ts、unit: gata gata 回帰テスト |
| A9 | ずれた一指入力で進行 | E2E: レバー40pxオフセット+斜めスワイプで lock | PASS | tests/e2e/safety.spec.ts |
| A10 | 連打・逆スワイプ・途中離脱に耐える | E2E safety 4本 + unit | PASS | tests/e2e/safety.spec.ts, artifacts/playtest/safety/ |
| A11 | タッチ対象 ≥64px | E2E: 全phaseの getHotspots() を assert | PASS(最小64=gear、主要72〜120) | full-loop.spec.ts checkTargets |
| A12 | 全画面点滅なし | E2E: grind中のフレーム間平均輝度変化 <0.18 + 実装制約 | PASS(実測はるかに小) | full-loop.spec.ts flickerMax |
| A13 | 光・動き・音の軽減設定 | E2E: トグル→輝度低下・masterGain低下・リロード後永続 | PASS | tests/e2e/settings.spec.ts, artifacts/playtest/settings/ |
| A14 | 2タップ以内で再開 | E2E: replaySame 1タップ→arrive→scanBefore(scan可) | PASS | full-loop.spec.ts 末尾 |
| A15 | MVP外機能なし | コード全走査(通貨/星/スコア/タイマー等の不存在) | PASS(該当実装なし) | src/ 全体、CLAUDE.md 禁止事項 |
| A16 | 証拠が残っている | ファイル存在 | PASS | artifacts/playtest/ 8ディレクトリ、docs/ 6ファイル |
| A17 | テストの弱体化なし | skip/only 不使用、削除なし(履歴) | PASS | git log、tests/ に skip/only なし |

## 検査コマンドの最新結果(2026-08-04)

- `npm run typecheck` — PASS(エラー0)
- `npm test`(vitest) — 21/21 PASS
- `npx playwright test` — 11/11 PASS(3.6m)
- `npm run build` — PASS(53KB js / gzip 16.6KB)

## 独立検証(game-feel-verifier)

- 2026-08-04 実施(新規コンテキスト・実マウスジェスチャ・4寸法×2周)。
- P0: 0件 / P1: 3件 / P2: 6件 → 全件修正し、unit+E2E 全通過で再検証済み。
- 詳細と対応は docs/PLAYTEST_LOG.md、証拠は artifacts/playtest/verifier/。
