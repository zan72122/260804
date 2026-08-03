# RAIL_DOMAIN_NOTES — 公式資料から確認した、ゲームに必要な事実だけ

調査担当: rail-domain-auditor 相当 subagent(2026-08-03)。
注: 4対象ページとも直接fetchは環境のproxyで403だったため、同一公式ドメインの
検索エンジン要約(および Loram "Production Rail Grinding" / Vossloh "High Speed
Grinding technology" 等の姉妹ページ)から抽出。組織の代替は不要だった。

| # | 事実 | 出典 | ゲームへの反映 |
|---|------|------|----------------|
| 1 | 削正はレール頭部から薄い金属層を除去して疲労を抑え寿命を延ばす | Network Rail "Track treatment fleet" | 「薄く削る」を中核動作に。深掘りや破壊はしない |
| 2 | 削正作業は主に夜間の線路閉鎖(possession)時間帯、低速(1–10 km/h)で行う | Network Rail "Track treatment fleet" | 舞台は夜の閉鎖線路。削正車はゆっくり進む |
| 3 | 回転する砥石/削正ユニットがレールに角度をつけて接触して削る | Vossloh "Mobile Grinding" / HSG | ユニットは回転し、接触して初めて削れる・火花が出る |
| 4 | 1パスの除去量はごく薄く(HSGで約0.1–0.4mm)、連続的で均一 | Vossloh "Mobile Grinding" | レール変形は差し替えでなく連続的に滑らかへ |
| 5 | 作業前後に縦方向・横断面のレール形状を測定し、削り量を決める | Vossloh "smart HSG-city" | 作業前スキャン→削正→作業後スキャンの前後比較を看板に |
| 6 | 削正で車輪-レール接触が滑らかになり、騒音・振動が約3–15dB改善 | Vossloh "smart HSG-city" / Network Rail | 試験列車の音と揺れが「ガタガタ」→「スーッ」に変わる |
| 7 | 火花(熱い切粉)対策として散水・防火設備・スパークガードを併設 | Loram "Rail Grinding Best Practice" | 火花の後方に防護板と水ミストが追従。ミストはタップで強化可 |
| 8 | 「ちょうど良い量だけ削る」のが良い削正(削りすぎない) | Loram "Rail Grinding Best Practice" | 速くても遅くても修理成功。採点はせず、削り過ぎ失敗も作らない |

## 再現しないもの(意図的)

工学計算、実車の砥石数、運転資格、作業指令、パス数管理、削りすぎペナルティ。
