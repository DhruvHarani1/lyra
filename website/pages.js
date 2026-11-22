/* Shared by the secondary pages: scroll reveals and a soft cursor glow. */
document.documentElement.classList.add('js')
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const els = [...document.querySelectorAll('.rv')]
if (reduce || !('IntersectionObserver' in window)) els.forEach((e) => e.classList.add('in'))
else {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
  els.forEach((e) => io.observe(e))
}
const spot = document.getElementById('spot')
if (spot && !reduce && matchMedia('(pointer: fine)').matches) {
  addEventListener('pointermove', (e) => { spot.style.left = e.clientX + 'px'; spot.style.top = e.clientY + 'px'; spot.classList.add('on') }, { passive: true })
  document.addEventListener('pointerleave', () => spot.classList.remove('on'))
}
