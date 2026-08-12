/* にじいろタウン - localStorage 永続化
   完成画像ではなく「元ストローク＋点＋色＋シード」を保存して毎回再構築する */
window.NT = window.NT || {};
(function () {
  const KEY = 'nijiiro-town-v1';

  function blank() {
    return { v: 1, tutorialDone: false, works: { garden: null, house: null, cake: null } };
  }

  const SV = {
    data: blank(),

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && d.v === 1 && d.works) { SV.data = d; return SV.data; }
        }
      } catch (e) { /* 壊れていたら初期化 */ }
      SV.data = blank();
      return SV.data;
    },

    store() {
      try { localStorage.setItem(KEY, JSON.stringify(SV.data)); } catch (e) {}
    },

    // record: {colorIdx, seed, pts:[{x,y,w}], pon:{x,y}}
    setWork(siteId, record) {
      SV.data.works[siteId] = {
        colorIdx: record.colorIdx,
        seed: record.seed,
        pon: [Math.round(record.pon.x), Math.round(record.pon.y)],
        pts: record.pts.map(p => [Math.round(p.x), Math.round(p.y), Math.round((p.w || 14) * 10) / 10])
      };
      SV.store();
    },

    getWork(siteId) {
      const w = SV.data.works[siteId];
      if (!w) return null;
      return {
        colorIdx: w.colorIdx,
        seed: w.seed,
        pon: { x: w.pon[0], y: w.pon[1] },
        pts: w.pts.map(a => ({ x: a[0], y: a[1], w: a[2] }))
      };
    },

    setTutorialDone() {
      SV.data.tutorialDone = true;
      SV.store();
    },

    clear() {
      SV.data = blank();
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  };

  NT.save = SV;
})();
