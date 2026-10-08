"use strict";
const StorageModule = (() => {
  const options = [
    {name:"PostgreSQL",type:"Relational SQL",best:"Complex relationships, financial data, scalable web applications.",strength:"Strong transactions, constraints, advanced queries.",consider:"Requires a database server and backend/API."},
    {name:"MySQL",type:"Relational SQL",best:"Web apps, structured business data, common hosting.",strength:"Mature ecosystem, SQL, transactions with InnoDB.",consider:"Requires a backend/API for secure web access."},
    {name:"SQLite",type:"Embedded SQL",best:"Mobile, desktop, prototypes, single-device applications.",strength:"Lightweight, serverless, transactional.",consider:"Not a typical shared database for many web clients."},
    {name:"MongoDB",type:"Document NoSQL",best:"Flexible JSON-like documents and changing schemas.",strength:"Flexible document model and indexes.",consider:"Relationships and consistency still require careful design."},
    {name:"IndexedDB",type:"Browser storage",best:"Offline-first web apps and browser-local data.",strength:"Built into browsers; supports structured data and blobs.",consider:"Data is local to browser/origin; syncing and backups need implementation."},
    {name:"Firebase Firestore",type:"Cloud document NoSQL",best:"Real-time collaboration, mobile/web apps, managed backend.",strength:"Managed sync and realtime listeners.",consider:"Usage-based costs, security rules, and data modeling tradeoffs."},
  ];
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  function initialize(project,saveProject,target){
    if(!project.storage || typeof project.storage!=="object" || Array.isArray(project.storage))project.storage={};
    const saved=project.storage;
    const wrapper=el("div","storage-module");
    wrapper.append(el("h3","","Data Storage"),el("p","question-help","Compare storage options and document why one fits your project. Your choice is a planning decision, not an automatic database installation."));
    const tableWrap=el("div","storage-table-wrap");const table=el("table","storage-table");const head=el("thead");const hr=el("tr");["Technology","Type","Best suited for","Strength","Consideration"].forEach(t=>hr.append(el("th","",t)));head.append(hr);table.append(head);
    const body=el("tbody");options.forEach(o=>{const tr=el("tr");[o.name,o.type,o.best,o.strength,o.consider].forEach(v=>tr.append(el("td","",v)));body.append(tr)});table.append(body);tableWrap.append(table);wrapper.append(tableWrap);
    const form=el("form","planning-form storage-form");
    function field(labelText,key,kind,placeholder){const group=el("div","form-group");const label=el("label","",labelText);let control;if(kind==="select"){control=el("select","form-input");const empty=el("option","","Choose a technology");empty.value="";control.append(empty);options.forEach(o=>{const opt=el("option","",o.name);opt.value=o.name;control.append(opt)});const other=el("option","","Other / undecided");other.value="Other / undecided";control.append(other);}else{control=el("textarea","form-input");control.rows=3;control.placeholder=placeholder||"";}control.name=key;control.value=saved[key]||"";label.append(control);group.append(label);form.append(group);return control;}
    const tech=field("Selected storage technology","technology","select");
    field("Why does it fit this project?","reason","textarea","Explain your choice in your own words.");
    field("Where will the data live?","hosting","textarea","Example: managed PostgreSQL in the cloud, or local IndexedDB.");
    field("How will the app access the data?","access","textarea","Example: frontend → API → database. Never place database passwords in frontend code.");
    field("Backup, security and recovery plan","security","textarea","Example: authentication, permissions, scheduled backups and restore testing.");
    field("Alternatives considered / open questions","alternatives","textarea","What other options did you evaluate?");
    const status=el("p","storage-status");status.setAttribute("role","status");const button=el("button","btn btn-primary","Save Data Storage Plan");button.type="submit";form.append(button,status);
    form.addEventListener("submit",async event=>{event.preventDefault();button.disabled=true;status.textContent="Saving...";const previous={...project.storage};project.storage=Object.fromEntries(new FormData(form).entries());project.updatedAt=new Date().toISOString();try{const ok=await saveProject(project);if(!ok){project.storage=previous;status.textContent="Could not save. Please try again.";}else status.textContent="Data storage plan saved.";}catch(err){console.error(err);project.storage=previous;status.textContent="Could not save. Please try again.";}finally{button.disabled=false;}});
    wrapper.append(form);target.append(wrapper);
  }
  return {initialize};
})();
