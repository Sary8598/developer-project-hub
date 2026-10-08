"use strict";
const TechnologiesModule = (() => {
  const catalog = [
    {area:"Frontend",items:["HTML / CSS / JavaScript","React + TypeScript","Vue + TypeScript","Angular","Other / undecided"],help:"The interface users interact with. Vanilla JavaScript is a great starting point; frameworks help manage larger interfaces."},
    {area:"Backend",items:["Node.js + Express","Node.js + Fastify","Python + FastAPI","Python + Django","Java + Spring Boot","C# + ASP.NET Core","No backend (local-only)","Other / undecided"],help:"Server-side logic, authentication and secure database access. Never expose server credentials in frontend code."},
    {area:"Architecture",items:["Client–server / REST API","Monolith","Layered architecture","Serverless","Offline-first","Microservices","Other / undecided"],help:"How the parts fit together. A simple layered monolith is often easier to maintain than microservices for a first project."},
    {area:"Version Control",items:["Git + GitHub","Git + GitLab","Git + Bitbucket","Local Git","Other / undecided"],help:"Track changes and collaborate. Keep passwords, API keys and .env files out of repositories."},
    {area:"Design",items:["Figma","Penpot","Canva","Paper wireframes","Other / undecided"],help:"Plan screens and interactions before building them."},
    {area:"API Testing",items:["Postman","Insomnia","Bruno","VS Code REST Client","Browser DevTools","Not needed yet"],help:"Test requests and responses independently of the interface."},
    {area:"Testing",items:["Vitest","Jest","Playwright","Cypress","Manual testing first","Other / undecided"],help:"Unit tests verify logic; end-to-end tests verify real user journeys."},
    {area:"Deployment",items:["Vercel","Netlify","Cloudflare Pages","Render","Railway","AWS","Self-hosted VPS","Local only / undecided"],help:"Where the app runs. Hosting for a static frontend may differ from hosting for an API and database."}
  ];
  const make = (tag, cls, text) => {const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function initialize(project, saveProject, target) {
    if (!project.technologies || typeof project.technologies!=="object" || Array.isArray(project.technologies)) project.technologies={};
    const stored=project.technologies;
    const wrap=make("section","tech-module");
    wrap.append(make("h3","","Technologies & Architecture"),make("p","question-help","Choose tools that match the project scope and your experience. These are planning decisions, not automatic installations."));
    const hint=make("div","tech-note");
    hint.append(make("strong","","Beginner tip: "),document.createTextNode("Start with the smallest stack that solves your problem. You can update these decisions as your project evolves."));wrap.append(hint);
    const form=make("form","planning-form tech-form");
    function addField(title,key,options,help,placeholder){
      const group=make("div","form-group");const label=make("label","",title);label.htmlFor=`tech-${key}`;group.append(label);
      if(help)group.append(make("p","question-help",help));
      const control=make(options?"select":"textarea","form-input");control.id=`tech-${key}`;control.name=key;
      if(options){const empty=make("option","","Choose an option");empty.value="";control.append(empty);options.forEach(item=>{const opt=make("option","",item);opt.value=item;control.append(opt)});}
      else {control.rows=3;control.placeholder=placeholder||"";}
      control.value=stored[key]||"";group.append(control);form.append(group);return control;
    }
    catalog.forEach(section=>addField(section.area,section.area.toLowerCase().replaceAll(" ","_"),section.items,section.help));
    const storage=project.storage?.technology||"Not selected yet";
    const db=make("div","tech-note");db.append(make("strong","","Database (from Data Storage): "),document.createTextNode(storage));form.append(db);
    addField("Why does this stack fit?","rationale",null,"Explain the main trade-offs and why this stack is appropriate.","Example: JavaScript on both frontend and backend helps me focus on one language.");
    addField("How will the parts communicate?","communication",null,"Describe the flow between UI, API, authentication and database.","Example: React UI → HTTPS REST API → PostgreSQL.");
    addField("Project structure / conventions","organization",null,"Describe folders, modules, naming conventions or architectural layers.","Example: src/components, src/pages, server/routes, server/services.");
    addField("Security, deployment and environment notes","operations",null,"Think about secrets, hosting, environment variables and deployment steps.","Example: store secrets on the server; use HTTPS; separate dev and production.");
    addField("Learning goals / open questions","learning",null,"Record what you still need to learn or evaluate.","Example: Learn API routes, validation and authentication before deployment.");
    const status=make("p","tech-status");status.setAttribute("role","status");
    const btn=make("button","btn btn-primary","Save Technology Plan");btn.type="submit";form.append(btn,status);
    form.addEventListener("submit",async e=>{
      e.preventDefault();btn.disabled=true;status.textContent="Saving...";
      const previous={...project.technologies};const previousDate=project.updatedAt;
      project.technologies=Object.fromEntries(new FormData(form).entries());project.updatedAt=new Date().toISOString();
      try {if(await saveProject(project))status.textContent="Technology plan saved.";else {project.technologies=previous;project.updatedAt=previousDate;status.textContent="Could not save. Please try again.";}}
      catch(err){console.error(err);project.technologies=previous;project.updatedAt=previousDate;status.textContent="Could not save. Please try again.";}
      finally{btn.disabled=false;}
    });
    wrap.append(form);target.append(wrap);
  }
  return {initialize};
})();
