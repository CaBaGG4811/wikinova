const B = 'http://localhost:3001';
let fail = 0;
const ok = (cond, name, detail = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' ' + detail : ''));
  if (!cond) fail++;
};

(async () => {
  const html = await (await fetch(B + '/')).text();
  ok(html.includes('whitespace-nowrap'), 'whitespace-nowrap present');
  ok(html.includes('hidden lg:flex'), 'desktop nav lg+');
  ok(html.includes('hidden xl:inline-flex'), 'secondary nav xl only');
  ok(/lg:hidden[^>]*btn-ghost|btn-ghost[^>]*lg:hidden/.test(html) || html.includes('lg:hidden btn-ghost'), 'hamburger lg:hidden');
  ok(html.includes('Открыть меню') || html.includes('aria-label="Открыть меню"'), 'hamburger aria');
  ok(!html.includes('transition-all'), 'no transition-all');
  ok(!html.includes('scale-105'), 'no scale-105');
  ok(html.includes('md:gap-4'), 'adaptive gap');
  ok(html.includes('/articles') && html.includes('/collections') && html.includes('/graph') && html.includes('/request'), 'primary links');
  ok(html.includes('/about') && html.includes('/rules'), 'secondary links');
  // no old wrapping nav without nowrap
  const oldNav = /class="px-2\.5 py-1\.5 rounded-md text-muted hover:text-ink hover:bg-ink\/5 transition-colors duration-150"/;
  ok(!oldNav.test(html), 'old nav link class without nowrap gone');

  console.log(fail === 0 ? 'ALL HEADER CHECKS PASSED' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
