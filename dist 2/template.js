import{d as z,a3 as k,m as v,k as g}from"./ui.js";import{p as s}from"./vendor-dompurify.js";import{g as h,I as T,X as M,T as C,j as b,k as S}from"./vendor-firebase-core.js";import"./notificationHelpers.js";import"./vendor.js";const c=[{title:"16 hatch",category:"zerg",image:"img/race/zerg.webp",data:`[15/14] Overlord
[16] Hatchery
[18] extractor
[17] Spawning Pool`},{title:"15/15/15 gasless",category:"zerg",image:"img/race/zerg.webp",data:`[15/14] hatchery
[15/14] overlord
[15/14] spawning pool
[20] 2 queen
[24] zergling
[27] overlord
[28] hatchery`},{title:"14gas 14pool",category:"zerg",image:"img/race/zerg.webp",data:`[12] Overlord
[14] Spawning Pool
[16] Zergling Rush`},{title:"Double Gas",category:"terran",image:"img/race/terran.webp",data:`[14] Supply Depot
[15] Barracks
[16] Refinery
[17] refinery
100% rax upgrade orbital command + 1 reaper
[20] factory`},{title:"Reaper Expand",category:"terran",image:"img/race/terran.webp",data:`[14] Supply Depot
[16] Barracks
[16] Refinery
100% rax upgrade orbital command + 1 reaper
[20] command center`},{title:"Gate|Core|Nexus",category:"protoss",image:"img/race/protoss.webp",data:`[14] Pylon
[16] Gateway
[17] Assimilator
[20] Cybernetics Core
[21] Nexus`},{title:"Gate|Nexus|Core",category:"protoss",image:"img/race/protoss.webp",data:`[14] Pylon
[16] Gateway
[17] Assimilator
[20] Nexus
[20] cybernetics core
`}];let d=[],r=[...c];async function $(){try{const t=h().currentUser;if(!t)return d=[],r=[...c],r;const a=T(),o=b(a,`users/${t.uid}/templates`);return d=(await S(o)).docs.map(n=>n.data()).filter(n=>n&&n.title&&n.category&&n.data).map(n=>({title:String(n.title),category:String(n.category).toLowerCase(),image:n.image||`img/race/${String(n.category).toLowerCase()}.webp`,data:String(n.data)})),r=[...c,...d],r}catch(e){return console.error("Failed to load user templates:",e),[...c]}}async function x(){const e=document.getElementById("templateModal");e&&(e.style.display="block",window.hydrateLazyImages&&window.hydrateLazyImages(e)),await $(),m(r)}function I(){const e=document.getElementById("templateModal");e.style.display="none"}function m(e){const t=document.getElementById("templateList");t.innerHTML="",e.forEach((a,o)=>{const i=document.createElement("div");i.className="template-card",i.setAttribute("data-template",JSON.stringify(a)),i.innerHTML=`
    <div class="template-card-header" style="background-image: url('${s.sanitize(a.image)}');"></div>
    <div class="template-card-title">${s.sanitize(a.title)}</div>
    `,i.addEventListener("click",()=>N(a)),t.appendChild(i)})}function j(e){const t=document.getElementById("templatePreview"),a=s.sanitize(e.data).split(`
`).map(o=>{const i=o.match(/^\[(.*?)\]\s*(.*)$/);if(i){const[,n,p]=i;return`<div class="template-line"><span class="template-bracket">[${n}]</span> ${v(p)}</div>`}else return`<div class="template-line">${v(o)}</div>`}).join("");t.innerHTML=`
    <h4>${s.sanitize(e.title)}</h4>
    <div class="template-preview-block">${a}</div>
  `}function A(){const e=document.getElementById("saveTemplateModal");e.style.display="block",window.hydrateLazyImages&&window.hydrateLazyImages(e);const t=document.getElementById("closeSaveTemplateModal");t.onclick=()=>{e.style.display="none"},window.onclick=o=>{o.target===e&&(e.style.display="none")};const a=document.getElementById("saveTemplateConfirmButton");a.onclick=async()=>{var w;const i=h().currentUser;if(!i){g("Sign in to save templates.","info");const l=document.getElementById("auth-container");l&&(l.classList.add("highlight"),setTimeout(()=>l.classList.remove("highlight"),5e3));return}const n=document.getElementById("templateTitleInput").value.trim(),p=s.sanitize(n),u=(w=document.querySelector('input[name="templateRace"]:checked'))==null?void 0:w.value;if(!p||!u){alert("Please provide a title and select a race.");return}const E=document.getElementById("buildOrderInput").value.trim(),y=s.sanitize(E);if(!y){alert("Build order input cannot be empty.");return}const B=`img/race/${u}.webp`;try{const l=T(),f={title:p,category:u,image:B,data:y,createdAt:M.now()};await C(b(l,`users/${i.uid}/templates`),f),d.push(f),r=[...c,...d],m(r),g("Template saved!","success"),e.style.display="none"}catch(l){console.error("Failed to save template:",l),g("Failed to save template.","error")}}}function D(){A()}function F(e){r.splice(e,1),m(r)}function L(e){const t=e==="all"?r:r.filter(a=>a.category===e);m(t)}function O(){const e=document.getElementById("templateModal"),t=document.getElementById("closeTemplateModal");t&&t.addEventListener("click",()=>{e&&(e.style.display="none")}),window.addEventListener("click",a=>{e&&a.target===e&&(e.style.display="none")})}function J(e){const t=e.toLowerCase(),a=r.filter(o=>o.title.toLowerCase().includes(t));m(a)}function R(){const e=document.querySelectorAll("#templateFilters .filter-category");e.forEach(t=>{t.addEventListener("click",()=>{const a=t.getAttribute("data-category");e.forEach(o=>o.classList.remove("active")),t.classList.add("active"),L(a.toLowerCase())})})}function N(e){const t=document.getElementById("buildOrderInput");t.value=s.sanitize(e.data),z(t.value),k("template_used",{title:e.title,race:e.category}),I()}R();O();window.showTemplatesModal=x;window.closeTemplateModal=I;window.saveTemplate=D;window.deleteTemplate=F;window.filterTemplates=L;export{I as closeTemplateModal,F as deleteTemplate,L as filterTemplates,N as loadTemplateFromTemplateData,m as populateTemplateList,j as previewTemplate,D as saveTemplate,J as searchTemplates,O as setupTemplateModal,A as showSaveTemplateModal,x as showTemplatesModal};
//# sourceMappingURL=template.js.map
