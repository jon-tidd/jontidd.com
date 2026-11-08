// Classic script (no modules) so it also runs on browsers too old for the app itself.
(function () {
  var done = false;
  function say(text, final) {
    var el = document.getElementById('loading');
    if (!el || done) return;
    el.textContent = text;
    if (final) done = true;
  }
  if (!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('importmap'))) {
    say('This room planner needs iPadOS/iOS 16.4 or newer, or a current Chrome, Edge, Firefox or Safari.', true);
  }
  // a script (the app or the 3D engine from the CDN) failed to load
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'SCRIPT') say('The 3D engine couldn’t load. Check the connection and reload.', true);
  }, true);
  // main.js removes #loading once the room is up
  setTimeout(function () { say('Still loading… try reloading the page'); }, 20000);
})();
