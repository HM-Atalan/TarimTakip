// Google Drive Picker: dosyanın kendisi TarımTakip'e veya Firebase'e yüklenmez.
window.DRIVE_STATE={token:null,pickerReady:false,gisReady:false,tokenClient:null,config:null};

window.loadExternalScript=(src,id)=>new Promise((resolve,reject)=>{
  const existing=document.getElementById(id);
  if(existing){ if(existing.dataset.ready==='1') resolve(); else existing.addEventListener('load',resolve,{once:true}); return; }
  const script=document.createElement('script'); script.id=id; script.src=src; script.async=true; script.defer=true;
  script.onload=()=>{script.dataset.ready='1';resolve();}; script.onerror=()=>reject(new Error('Google bağlantı bileşeni yüklenemedi.'));
  document.head.appendChild(script);
});

window.initGoogleDrive=async()=>{
  if(!window.DRIVE_STATE.config){
    const [clientId,apiKey,appId]=await Promise.all(['GDRIVE_CLIENT_ID','GDRIVE_API_KEY','GDRIVE_APP_ID'].map(window.getRemoteSetting));
    if(!clientId||!apiKey||!appId) throw new Error('Google Drive bağlantısı yönetici tarafından henüz yapılandırılmadı.');
    window.DRIVE_STATE.config={clientId,apiKey,appId};
  }
  await Promise.all([
    window.loadExternalScript('https://apis.google.com/js/api.js','google-api-loader'),
    window.loadExternalScript('https://accounts.google.com/gsi/client','google-gis-loader')
  ]);
  if(!window.DRIVE_STATE.pickerReady) await new Promise((resolve,reject)=>window.gapi.load('picker',{callback:()=>{window.DRIVE_STATE.pickerReady=true;resolve();},onerror:()=>reject(new Error('Google Picker açılamadı.'))}));
  if(!window.DRIVE_STATE.tokenClient){
    window.DRIVE_STATE.tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:window.DRIVE_STATE.config.clientId,
      scope:'https://www.googleapis.com/auth/drive.file',
      callback:()=>{}
    });
  }
};

window.requestDriveToken=async()=>{
  await window.initGoogleDrive();
  return new Promise((resolve,reject)=>{
    const client=window.DRIVE_STATE.tokenClient;
    client.callback=response=>{
      if(response?.error){reject(new Error(response.error_description||response.error));return;}
      window.DRIVE_STATE.token=response.access_token; resolve(response.access_token);
    };
    client.requestAccessToken({prompt:window.DRIVE_STATE.token?'':'consent'});
  });
};

window.chooseDrivePhoto=async()=>{
  if(!window.FB_USER){window.toast('Google Drive için hesabınızla giriş yapmalısınız.',true);return;}
  try{
    const token=window.DRIVE_STATE.token||await window.requestDriveToken();
    const view=new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES).setIncludeFolders(false);
    const picker=new google.picker.PickerBuilder().addView(view).setOAuthToken(token)
      .setDeveloperKey(window.DRIVE_STATE.config.apiKey).setAppId(window.DRIVE_STATE.config.appId)
      .setCallback(async data=>{
        if(data[google.picker.Response.ACTION]!==google.picker.Action.PICKED)return;
        const doc=data[google.picker.Response.DOCUMENTS]?.[0]; if(!doc)return;
        window.pendingDrivePhoto={
          driveFileId:String(doc[google.picker.Document.ID]||''),
          driveName:String(doc[google.picker.Document.NAME]||'Fotoğraf'),
          mimeType:String(doc[google.picker.Document.MIME_TYPE]||'image/jpeg'),
          driveUrl:window.safeHttpUrl(doc[google.picker.Document.URL]||'')
        };
        window.pendPh=await window.getDrivePhotoData(window.pendingDrivePhoto);
        qs('#p-prev').innerHTML=`<img src="${window.esc(window.pendPh)}" alt="Seçilen fotoğraf" style="width:100%;max-height:180px;object-fit:cover;border-radius:var(--r);"/>`;
        qs('#p-size-info').textContent=`Seçildi: ${window.pendingDrivePhoto.driveName}`;
      }).build();
    picker.setVisible(true);
  }catch(error){window.toast('Google Drive: '+error.message,true);}
};

window.getDrivePhotoData=async photo=>{
  if(!photo?.driveFileId) return '';
  const token=window.DRIVE_STATE.token||await window.requestDriveToken();
  const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(photo.driveFileId)}?alt=media`,{headers:{Authorization:`Bearer ${token}`}});
  if(response.status===401){window.DRIVE_STATE.token=null;throw new Error('Drive oturumu sona erdi. Yeniden bağlanın.');}
  if(!response.ok) throw new Error(`Fotoğraf alınamadı (${response.status}).`);
  const blob=await response.blob();
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
};
