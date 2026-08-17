// ============================================================
// auth.js – Kimlik doğrulama (Firebase / yerel mod)
// ============================================================

window.swAuthTab = (tab, el) => {
  qs('#auth-screen .auth-pane.on')?.classList.remove('on');
  qs('#ap-'+tab)?.classList.add('on');
  qs('#auth-screen .auth-tab.on')?.classList.remove('on');
  el.classList.add('on');
};

window.signGoogle = async () => {
  if(!window.FB_MODE){ noFBNotice(); return; }
  try{ await window.fbSignInGoogle(); }catch(e){ showAErr('login',e.message); }
};

window.signEmail = async (mode) => {
  if(!window.FB_MODE){ noFBNotice(); return; }
  const em=qs(mode==='login'?'#login-email':'#reg-email')?.value;
  const pw=qs(mode==='login'?'#login-pass':'#reg-pass')?.value;
  try{
    if(mode==='login') await window.fbSignInEmail(em,pw);
    else await window.fbRegisterEmail(em,pw);
  }catch(e){ showAErr(mode,e.message); }
};

window.showAErr = (m,msg) => { const el=qs('#'+m+'-err'); if(el){ el.style.display='block'; el.textContent=msg; } };

window.noFBNotice = () => { qs('#no-fb-note').style.display='block'; qs('#auth-form-wrap').style.display='none'; };

window.enterLocalMode = async () => {
  LOCAL=true; qs('#auth-screen').classList.add('hidden');
  loadLocalDB();
  await window.prepareMoistureModels(DB.fields);
  await renderAll();
  DB.fields.forEach(f=>fetchWX(f));
  toast('Yerel modda çalışıyorsunuz');
};

window.doSignOut = async () => { if(window.FB_MODE&&window.FB_USER) await window.fbSignOut(); else{ LOCAL=false; DB.fields=[]; } qs('#auth-screen')?.classList.remove('hidden'); };

window.onAuthChange = async (user) => {
  if(user){
    qs('#auth-screen').classList.add('hidden');
    updateChip(user);
    await syncFromDB();
  }else{
    if(!LOCAL) qs('#auth-screen')?.classList.remove('hidden');
  }
};

window.updateChip = (user) => {
  if(!user) return;
  const av=qs('#user-avatar'); const nm=qs('#user-name');
  const photoURL = window.safeHttpUrl(user.photoURL);
  if(photoURL) av.innerHTML=`<img src="${window.esc(photoURL)}" alt="" style="width:22px;height:22px;border-radius:50%;"/>`;
  else av.textContent=(user.displayName||user.email||'?')[0].toUpperCase();
  if(nm) nm.textContent=user.displayName||user.email||'';
  const ai=qs('#account-info');
  if(ai) ai.innerHTML=`<div style="font-size:13px;"><strong>${window.esc(user.displayName||'')}</strong><br/>${window.esc(user.email||'')}</div>`;
};
