"use strict";
/* Developer Project Hub: full printable documentation for all nine stages. */
const PDFModule = (() => {
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const arr = value => Array.isArray(value) ? value : [];
  const label = value => String(value || "").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[-_]/g," ").replace(/^./, c=>c.toUpperCase());
  const filled = value => value !== null && value !== undefined && String(value).trim() !== "";
  const field = (key, value) => filled(value) ? `<div class="field"><strong>${esc(label(key))}</strong><p>${esc(value)}</p></div>` : "";
  const chapter = (number, title, body) => body ? `<section class="chapter" id="chapter-${number}"><h2><span>${number}.</span> ${esc(title)}</h2>${body}</section>` : "";
  const group = (title, body) => body ? `<div class="group"><h3>${esc(title)}</h3>${body}</div>` : "";
  const obj = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  function fields(value, exclude = []) {
    return Object.entries(obj(value)).filter(([key]) => !exclude.includes(key)).map(([key, v]) => {
      if (Array.isArray(v)) return v.length ? field(key, v.map(x=> typeof x === "object" ? x.title || x.name || JSON.stringify(x) : x).join(", ")) : "";
      return typeof v === "object" ? fields(v) : field(key,v);
    }).join("");
  }
  function cards(items, titleKey="title", exclude=[]) {
    return arr(items).map((item,i)=>`<article class="record"><h4>${esc(item?.[titleKey] || item?.name || `Item ${i+1}`)}</h4>${fields(item,[titleKey,"id",...exclude])}</article>`).join("");
  }
  function overview(p) { return fields(p.planning?.overview); }
  function requirements(p) {
    return ["functional","non-functional"].map(type=>group(type === "functional" ? "Functional requirements" : "Non-functional requirements", cards(arr(p.requirements).filter(x=>x.type===type),"title",["type"]))).join("");
  }
  function structure(p,files) {
    const screens = arr(p.screens);
    return screens.map(s=>{
      const attached=files.filter(f=>f.screenId===s.id);
      return `<article class="record"><h4>${esc(s.name || "Screen")}</h4>${fields(s,["id","name"])}${attachments(attached)}</article>`;
    }).join("");
  }
  function attachments(files) {
    return files.length ? group("Attachments", files.map(f=>{
      const image=f.imageData ? `<img class="attachment" src="${f.imageData}" alt="${esc(f.name)}">` : "";
      return `<div class="asset"><span>${esc(f.name || "Attachment")}</span>${image}${!image ? '<p class="muted">Document stored in the complete ZIP backup (not embedded in this PDF).</p>' : ""}</div>`;
    }).join("")) : "";
  }
  function erDiagram(model) {
    const entities=arr(model.entities), relations=arr(model.relationships);
    if(!entities.length) return "";
    const width=760, cols=entities.length>1?2:1, cardW=cols===2?330:500, gapX=45, gapY=38;
    const pos=new Map(), blocks=[];
    entities.forEach((e,i)=>{
      const x=cols===2 ? 12+(i%2)*(cardW+gapX):90, y=15+Math.floor(i/cols)*190;
      pos.set(e.id,{x,y});
      const attrs=arr(e.attributes).slice(0,7);
      blocks.push(`<rect x="${x}" y="${y}" width="${cardW}" height="${155}" rx="7" fill="#fff" stroke="#8da7ce"/><rect x="${x}" y="${y}" width="${cardW}" height="31" rx="7" fill="#dce8fa"/><text x="${x+12}" y="${y+21}" font-size="15" font-weight="bold" fill="#18335d">${esc(e.name)}</text>${attrs.map((a,j)=>`<text x="${x+12}" y="${y+51+j*15}" font-size="12" fill="#27384d">${esc((a.primaryKey?"PK ":"")+a.name+" : "+a.type)}</text>`).join("")}`);
    });
    const lines=relations.map(r=>{
      const a=pos.get(r.from),b=pos.get(r.to); if(!a||!b) return "";
      const x1=a.x+cardW/2,y1=a.y+155,x2=b.x+cardW/2,y2=b.y;
      return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#4b6c9c" stroke-width="1.5" fill="none" stroke-dasharray="5 3"/>`;
    }).join("");
    const height=30+Math.ceil(entities.length/cols)*190;
    return `<div class="diagram"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Entity relationship diagram">${lines}${blocks.join("")}</svg></div>`;
  }
  function modeling(p) {
    const m=obj(p.dataModel);
    const entities=cards(m.entities,"name");
    const rel=arr(m.relationships).map(r=>{
      const from=arr(m.entities).find(e=>e.id===r.from)?.name || "Unknown";
      const to=arr(m.entities).find(e=>e.id===r.to)?.name || "Unknown";
      return `<article class="record"><h4>${esc(from)} → ${esc(to)}</h4>${field("Relationship",r.type)}${field("Description",r.description)}</article>`;
    }).join("");
    return group("Entity-relationship diagram",erDiagram(m))+group("Entities and attributes",entities)+group("Relationships",rel);
  }
  function development(p) {
    const d=obj(p.development), tasks=arr(d.tasks), done=tasks.filter(t=>t.status==="done").length;
    return (tasks.length ? `<p class="progress">Tasks completed: <b>${done} / ${tasks.length}</b> (${Math.round(done/tasks.length*100)}%)</p>` : "")+
      group("Development tasks",cards(tasks))+group("Test cases",cards(d.tests))+group("Bug tracker",cards(d.bugs))+group("Milestones",cards(d.milestones));
  }
  const stages=[
    ["Project Overview",(p)=>overview(p)],
    ["Requirements",(p)=>requirements(p)],
    ["Application Structure",(p,f)=>structure(p,f)],
    ["Data Modeling",(p)=>modeling(p)],
    ["Data Storage",(p)=>fields(p.storage)],
    ["Technologies & Architecture",(p)=>fields(p.technologies)],
    ["Functions & Logic",(p)=>cards(p.logicFunctions,"name")],
    ["UI/UX Resources",(p,f)=>fields(p.uiux)+attachments(f.filter(x=>x.uiuxAsset===true))],
    ["Development & Testing",(p)=>development(p)]
  ];
  function render(p,files) {
    const content=stages.map(([title,fn],i)=>({number:i+1,title,html:fn(p,files)})).filter(x=>x.html);
    const today=new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});
    const toc=content.map(x=>`<li><span>${x.number}. ${esc(x.title)}</span></li>`).join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(p.name)} - Project Documentation</title><style>
    @page{size:A4;margin:18mm 16mm}*{box-sizing:border-box}body{font:10.5pt/1.5 Arial,sans-serif;color:#253349;margin:0}h1{font-size:33pt;color:#18335d;overflow-wrap:anywhere}h2{font-size:17pt;color:#18335d;border-bottom:2px solid #dce8fa;padding-bottom:7px;break-after:avoid}h2 span{color:#5278b6}h3{font-size:12pt;color:#33527f;margin:18px 0 8px;break-after:avoid}h4{font-size:11pt;margin:0 0 8px;overflow-wrap:anywhere}.cover{min-height:245mm;display:flex;flex-direction:column;justify-content:center;break-after:page}.brand{letter-spacing:3px;color:#3c67b0;font-weight:700}.subtitle{font-size:17pt;color:#61738a}.rule{width:75px;height:5px;background:#3c67b0;margin:22px 0}.cover-meta{margin-top:32px;color:#667085}.toc{break-after:page}.toc ul{list-style:none;padding:0}.toc li{padding:9px 0;border-bottom:1px solid #e5ebf4}.chapter{margin:0 0 28px}.field{margin:0 0 10px;break-inside:avoid}.field strong{display:block;font-size:9pt;color:#49658a}.field p{white-space:pre-wrap;overflow-wrap:anywhere;margin:3px 0}.record{border:1px solid #dce4ef;border-left:3px solid #7799d1;padding:11px 13px;margin:0 0 12px;break-inside:avoid}.group{margin:12px 0 20px}.diagram{margin:14px 0;break-inside:avoid}.diagram svg{width:100%;height:auto;max-height:245mm}.attachment{display:block;max-width:100%;max-height:135mm;object-fit:contain;margin:8px 0}.asset{margin:10px 0;break-inside:avoid}.asset span{font-weight:bold}.muted,.footnote{color:#667085;font-size:9pt}.footnote{margin-top:35px;border-top:1px solid #ddd;padding-top:10px}.progress{padding:10px;background:#f1f5fb} @media screen{body{max-width:840px;padding:35px;margin:20px auto;box-shadow:0 1px 18px #0002}}@media print{.cover{min-height:235mm}}
    </style></head><body><div class="cover"><div class="brand">DEVELOPER PROJECT HUB</div><h1>${esc(p.name||"Untitled Project")}</h1><div class="rule"></div><div class="subtitle">Software Project Planning Document</div><div class="cover-meta">${esc(today)}<p>Project status: ${esc(label(p.status))}</p>${p.description?`<p>${esc(p.description)}</p>`:""}</div></div>
    ${content.length?`<section class="toc"><h2>Table of Contents</h2><ul>${toc}</ul></section>`:""}
    ${content.map(x=>chapter(x.number,x.title,x.html)).join("")||"<p>No planning information has been recorded yet.</p>"}
    <div class="footnote">Generated with Developer Project Hub. This PDF is documentation, not a restorable backup. Keep your Complete ZIP Backup.</div></body></html>`;
  }
  function readAsDataURL(blob) {return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
  async function projectFiles(projectId) {
    const db=await Database.open();
    const files=await new Promise((resolve,reject)=>{
      const tx=db.transaction("files","readonly");const req=tx.objectStore("files").getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    const relevant=files.filter(f=>f.projectId===projectId);
    const output=[];
    for(const f of relevant){
      const blob=f.blob||f.file||f.data;
      const mime=blob?.type||f.type||"";
      let imageData="";
      if(blob instanceof Blob && /^image\/(png|jpeg|webp|gif)$/.test(mime) && blob.size<=8*1024*1024){
        try{imageData=await readAsDataURL(blob);}catch(error){console.warn("Could not embed image",error);}
      }
      output.push({...f,imageData,blob:undefined,file:undefined,data:undefined});
    }
    return output;
  }
  async function exportProject(project) {
    if(!project){alert("Open a project first.");return;}
    const win=window.open("","_blank");
    if(!win){alert("Allow pop-ups to export the PDF.");return;}
    win.document.write("<!doctype html><title>Preparing documentation...</title><p style='font:16px Arial;padding:30px'>Preparing your project documentation...</p>");
    try{
      const files=await projectFiles(project.id);
      win.document.open();win.document.write(render(project,files));win.document.close();
      win.focus();
      // Give embedded images a chance to load before printing.
      await Promise.race([Promise.all(Array.from(win.document.images).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;}))),new Promise(resolve=>setTimeout(resolve,2500))]);
      if(!win.closed) win.print();
    }catch(error){console.error("PDF export failed",error);win.document.body.textContent="Could not prepare the PDF. Check the browser console.";alert("Could not export PDF. Your project data has not changed.");}
  }
  function initialize({getCurrentProject}) {
    const back=document.querySelector("#back-to-projects");
    if(!back) return;
    const button=document.createElement("button");button.type="button";button.className="btn btn-secondary";button.textContent="Export PDF";button.title="Print project documentation or Save as PDF";
    button.addEventListener("click",()=>exportProject(getCurrentProject()));
    back.insertAdjacentElement("afterend",button);
  }
  return {initialize};
})();
