// HALO LINK — パック開封（なぞって破る → 1枚ずつめくる → まとめ）
'use strict';
const Pack = (() => {
  const pickRar = tbl => { const r = Math.random() * 100; let acc = 0; for (const k of [4, 3, 2, 1]) { acc += tbl[k] || 0; if (r < acc) return k; } return 2; };
  function roll() {
    const out = [];
    for (let i = 0; i < 5; i++) {
      const rar = i < 3 ? 1 : pickRar(PACK.slot45[i - 3]);
      const pool = CARDS.filter(c => c.rar === rar);
      out.push(pool[Math.floor(Math.random() * pool.length)].id);
    }
    return out;
  }
  // 開ける：無料 → チケットの順に使う
  function canOpen() { Save.freeTick(); const s = Save.d; return s.free.n > 0 || s.ticket > 0; }
  async function open() {
    const s = Save.d; Save.freeTick();
    if (s.free.n > 0) s.free.n--; else if (s.ticket > 0) s.ticket--; else { toast('開けられるパックがありません'); return; }
    const ids = roll();
    const res = ids.map(id => { const isNew = !s.owned[id]; s.owned[id] = (s.owned[id] || 0) + 1; return {id, isNew}; });
    s.pt += PACK.ptPerPack; Save.put();
    await show(res);
  }

  // ===== 演出 =====
  async function show(res) {
    const ov = $('po');
    ov.innerHTML = `<div class="po-bg"></div>
      <div class="po-pack" id="poPack">${packHTML()}<div class="po-cutline"><i></i></div></div>
      <p class="po-guide" id="poGuide"><span>→</span>パックの上をなぞって開封</p>
      <button class="po-auto" id="poAuto">タップで開ける</button>`;
    ov.className = 'on';
    Sfx.play('tap');
    await tear();
    // カードを積んで、1枚ずつめくる
    ov.querySelector('#poGuide').remove(); ov.querySelector('#poAuto').remove();
    const stack = h('<div class="po-stack" id="poStack"></div>'); ov.appendChild(stack);
    res.slice().reverse().forEach((r, k) => {
      const c = cardById(r.id), i = res.length - 1 - k;
      const el = h(`<div class="po-card r${c.rar}${c.rar >= 3 ? ' back' : ''}" data-i="${i}">
        <div class="po-flip"><div class="po-front">${cardHTML(r.id, {cls:'big'})}${r.isNew ? '<em class="po-new">NEW</em>' : ''}</div><div class="po-backface"></div></div></div>`);
      stack.appendChild(el);
    });
    const cards = [...stack.children].reverse();   // 0が一番上
    cards.forEach((el, i) => el.animate([{transform:'translateY(60px) scale(.7)', opacity:0}, {transform:'none', opacity:1}], {duration:420, delay:i * 40, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards'}));
    const tip = h('<p class="po-tip">タップで次のカードへ</p>'); ov.appendChild(tip);
    await sleep(500);
    for (let i = 0; i < cards.length; i++) {
      const el = cards[i], c = cardById(res[i].id);
      if (c.rar >= 3) {
        // レア：裏向きで光る → タップでめくる
        el.classList.add('aura'); Sfx.play('rare', 2);
        tip.textContent = 'タップでめくる';
        await tapOnce(ov);
        el.classList.remove('back'); el.classList.add('flipped'); Sfx.play('flip'); vib(c.rar >= 4 ? 60 : 25);
        await sleep(380); Sfx.play('rare', c.rar);
        const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, c.rar >= 4 ? '#ff9ef5' : '#ffd85a', 34, 170);
        tip.textContent = 'タップで次のカードへ';
      } else if (i > 0) Sfx.play('flip');
      el.classList.add('show');
      await tapOnce(ov);
      if (i < cards.length - 1) {
        await el.animate([{transform:'none', opacity:1}, {transform:`translate(${i % 2 ? '' : '-'}120vw,-6vh) rotate(${i % 2 ? 18 : -18}deg)`, opacity:.6}], {duration:340, easing:'cubic-bezier(.5,0,.8,.4)', fill:'forwards'}).finished;
        el.remove(); Sfx.play('draw');
      }
    }
    // まとめ
    tip.remove(); stack.remove();
    const sum = h(`<div class="po-sum"><h3>GET!</h3><div class="po-grid">${res.map((r, i) => `<div class="po-g" style="animation-delay:${i * 70}ms">${cardHTML(r.id)}${r.isNew ? '<em class="po-new">NEW</em>' : ''}</div>`).join('')}</div>
      <p class="po-pt">パックポイント +${PACK.ptPerPack}（所持 ${Save.d.pt}）</p>
      <div class="po-btns"><button class="btn sub" id="poClose">閉じる</button>${canOpen() ? '<button class="btn main" id="poMore">もう1パック</button>' : ''}</div></div>`);
    ov.appendChild(sum);
    const more = await new Promise(r => { $('poClose').onclick = () => r(false); const m = $('poMore'); if (m) m.onclick = () => r(true); });
    ov.className = ''; ov.innerHTML = '';
    UI.refresh();
    if (more) open();
  }
  function tapOnce(el) { return new Promise(r => { const f = () => { el.removeEventListener('click', f); r(); }; setTimeout(() => el.addEventListener('click', f), 120); }); }

  // パックの上部を横になぞると破れる（またはボタン）
  function tear() {
    return new Promise(res => {
      const pk = $('poPack'), line = pk.querySelector('.po-cutline i');
      let sx = null, done = false;
      const finish = async () => {
        if (done) return; done = true;
        Sfx.play('tear'); vib(40);
        pk.classList.add('torn');
        const r = pk.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height * .12, '#fff', 30, 160);
        await sleep(700); pk.classList.add('gone'); await sleep(260); pk.remove(); res();
      };
      pk.addEventListener('pointerdown', e => { const r = pk.getBoundingClientRect(); if (e.clientY - r.top < r.height * .35) { sx = e.clientX; pk.setPointerCapture(e.pointerId); } });
      pk.addEventListener('pointermove', e => {
        if (sx == null) return; const r = pk.getBoundingClientRect(), p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        line.style.transform = `scaleX(${p})`; if (Math.random() < .3) Sfx.play('draw');
        if (Math.abs(e.clientX - sx) > r.width * .6) finish();
      });
      pk.addEventListener('pointerup', () => { sx = null; if (!done) line.style.transform = 'scaleX(0)'; });
      $('poAuto').onclick = finish;
    });
  }
  // パックの見た目（コードで描く。窓にはメモロビを入れる）
  function packHTML() {
    return `<div class="pk"><div class="pk-top"></div><div class="pk-body">
      <div class="pk-win" style="background-image:url(k_mika.webp)"></div>
      <div class="pk-logo">HALO<b>LINK</b></div><div class="pk-sub">BOOSTER 01 ・ 5 CARDS</div>
      <i class="pk-foil"></i></div></div>`;
  }
  return { open, canOpen, packHTML, roll };
})();
