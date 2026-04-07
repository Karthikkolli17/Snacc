const _dot = document.getElementById('cur-dot');
const _ring = document.getElementById('cur-ring');
let _mx = 0, _my = 0, _rx = 0, _ry = 0;
document.addEventListener('mousemove', e => { _mx = e.clientX; _my = e.clientY; });
_dot.style.left = _dot.style.top = '-100px';
_ring.style.left = _ring.style.top = '-100px';
(function _cursorLoop() {
  _rx += (_mx - _rx) * .13; _ry += (_my - _ry) * .13;
  _dot.style.left = _mx + 'px'; _dot.style.top = _my + 'px';
  _ring.style.left = _rx + 'px'; _ring.style.top = _ry + 'px';
  requestAnimationFrame(_cursorLoop);
})();
