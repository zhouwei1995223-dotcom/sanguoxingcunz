export default async function ({ wait, shot, tap, drag, page }) {
  await wait(800);
  await shot('01_loading');
  await wait(1500);
  await shot('02_privacy');
  // 同意（按钮在弹窗右下）
  await tap(280, 563);
  await wait(1200);
  await shot('03_battle_start');
  await drag(195, 600, 60, -40, 3000);
  await shot('04_battle_move');
  await drag(195, 600, -60, 30, 6000);
  await shot('05_battle_more');
}
