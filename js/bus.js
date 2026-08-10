// NBus — 極小イベントバス（ディレクター所有）
(function () {
  'use strict';
  var map = {};
  window.NBus = {
    on: function (name, fn) { (map[name] = map[name] || []).push(fn); },
    off: function (name, fn) {
      var a = map[name]; if (!a) return;
      var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
    },
    emit: function (name, payload) {
      var a = map[name]; if (!a) return;
      for (var i = 0; i < a.length; i++) {
        try { a[i](payload); } catch (e) { console.error('NBus handler error', name, e); }
      }
    },
  };
})();
