(()=>{
'use strict';
const q=s=>document.querySelector(s);
if(!localStorage.getItem(THEME_KEY)&&matchMedia('(prefers-color-scheme: light)').matches)document.body.classList.add('light');
function draft(text){els.input.value=text;autoResize();els.input.focus();}
function openTool(id){window.openStudyTool?.(id);closeSidebar();}
function library(){window.openStudyLibrary?.();closeSidebar();}
q('#sidebarCollapse').onclick=()=>document.body.classList.toggle('sidebar-collapsed');
q('#sidebarSearchToggle').onclick=()=>{document.body.classList.toggle('sidebar-collapsed',false);q('#sidebar').classList.toggle('searching');if(q('#sidebar').classList.contains('searching'))els.search.focus();};
q('#libraryNav').onclick=showChats;
q('#imagesNav').onclick=showImages;
q('#plannerNav').onclick=()=>openTool('planner');
q('#moreNav').onclick=library;
q('#allNotebooks').onclick=()=>openTool('notes');
q('#newNotebook').onclick=()=>window.newStudyNote?.();
q('#taskWorkspace').onclick=()=>openTool('planner');q('#chatWorkspace').onclick=()=>els.input.focus();
const menu=q('#composerMenu');const closeMenu=()=>{menu.hidden=true;q('#composerPlus').setAttribute('aria-expanded','false');};
q('#composerPlus').onclick=()=>{menu.hidden=!menu.hidden;q('#composerPlus').setAttribute('aria-expanded',String(!menu.hidden));};
q('#attachButton').addEventListener('click',closeMenu);
q('#composerStudy').onclick=()=>{closeMenu();library();};
q('#composerImage').onclick=()=>{closeMenu();draft(language==='en'?'Create an image of ':'Buatkan gambar ');};
q('#composerNotes').onclick=()=>{closeMenu();openTool('notes');};
document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!q('#composerPlus').contains(e.target))closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
function notes(){const list=q('#notebookList');list.textContent='';(window.studyNoteTitles?.()||[]).slice(0,4).forEach(title=>{const button=document.createElement('button');button.className='nav-item';button.innerHTML='<i data-icon="file-text"></i><span></span>';button.querySelector('span').textContent=title;button.title=title;button.onclick=()=>openTool('notes');list.append(button);});hydrateIcons(list);}
window.addEventListener('study-storage-change',notes);notes();
const modal=document.createElement('dialog');modal.className='study-library';modal.innerHTML='<div class="study-heading"><h2 id="workspaceModalTitle"></h2><button class="study-button" type="button" aria-label="Tutup pustaka">Tutup</button></div><div id="workspaceModalContent"></div>';modal.setAttribute('aria-labelledby','workspaceModalTitle');document.body.append(modal);modal.querySelector('button').onclick=()=>modal.close();
function showChats(){const content=modal.querySelector('#workspaceModalContent');q('#workspaceModalTitle').textContent='Pustaka percakapan';content.textContent='';if(!conversations.length){const p=document.createElement('p');p.className='study-muted';p.textContent='Percakapan yang kamu simpan akan muncul di sini.';content.append(p);}conversations.forEach(c=>{const b=document.createElement('button');b.className='library-chat';b.textContent=c.title;b.onclick=()=>{activeId=c.id;render();modal.close();closeSidebar();};content.append(b);});const tools=document.createElement('button');tools.className='study-button';tools.textContent='Buka alat & fitur';tools.onclick=()=>{modal.close();library();};content.append(tools);modal.showModal();}
function showImages(){q('#workspaceModalTitle').textContent='Gambar';const content=modal.querySelector('#workspaceModalContent');content.textContent='';const create=document.createElement('button');create.className='study-button primary';create.textContent='Buat gambar baru';create.onclick=()=>{modal.close();draft('Buatkan gambar ');closeSidebar();};content.append(create);const grid=document.createElement('div');grid.className='workspace-library-grid';const images=conversations.flatMap(c=>(c.messages||[]).filter(m=>m.image?.data).map(m=>({image:m.image,title:c.title})));for(const entry of images){if(!['image/png','image/jpeg','image/webp'].includes(entry.image.mime))continue;const fig=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption'),link=document.createElement('a');img.src='data:'+entry.image.mime+';base64,'+entry.image.data;img.alt=entry.image.alt||entry.title;caption.textContent=entry.title;link.href=img.src;link.download='intelligence-7mit.png';link.textContent='Unduh';fig.append(img,caption,link);grid.append(fig);}if(!images.length){const p=document.createElement('p');p.className='study-muted';p.textContent='Gambar yang dibuat di percakapanmu akan tampil di sini.';content.append(p);}content.append(grid);modal.showModal();}
})();
