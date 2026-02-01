import{j as t}from"./index-ZXlslG1z.js";import{m as b}from"./proxy-BFxRqQFC.js";const g=({tabs:l,activeTabId:i,onTabChange:o,layoutIdPrefix:n="tabs",className:d="",variant:r="primary",onTabClose:s})=>{const x=r==="primary"?`
            bg-white/80 dark:bg-[#1E293B]/90 
            backdrop-blur-xl 
            border border-slate-200/50 dark:border-slate-700
            shadow-lg shadow-slate-200/20 dark:shadow-xl dark:shadow-black/50
            p-1.5 rounded-full 
            ring-1 ring-slate-900/5 dark:ring-white/5
          `:`
            bg-slate-100/50 dark:bg-slate-800/50 
            border border-slate-200/50 dark:border-white/5 
            p-1 rounded-2xl
          `,c=r==="primary"?"text-slate-900 dark:text-white":"text-slate-800 dark:text-slate-100",p="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200";return t.jsx("div",{className:`inline-flex items-center justify-start max-w-full overflow-x-auto no-scrollbar ${x} ${d}`,children:l.map(e=>{const a=i===e.id;return t.jsxs("button",{onClick:()=>o(e.id,e.path),className:`
                            relative flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all duration-300 outline-none whitespace-nowrap z-10 flex-shrink-0
                            ${r==="primary"?"rounded-full":"rounded-xl"}
                            ${a?c:p}
                        `,style:{WebkitTapHighlightColor:"transparent"},children:[a&&t.jsx(b.div,{layoutId:`${n}-pill`,className:`
                                    absolute inset-0 
                                    bg-white dark:bg-slate-600/80 
                                    ${r==="primary"?"shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-none ring-1 ring-black/5 dark:ring-white/10 rounded-full":"rounded-xl shadow-sm"}
                                `,transition:{type:"spring",stiffness:400,damping:30}}),e.icon&&t.jsx("span",{className:`material-icons relative z-20 !text-[18px] transition-colors duration-300 ${a?"text-blue-600 dark:text-blue-400":"opacity-70"}`,children:e.icon}),t.jsx("span",{className:"relative z-20",children:e.label}),e.badge&&t.jsx("span",{className:`
                                relative z-20 ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] leading-none
                                ${a?"bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200":"bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}
                             `,children:e.badge}),s&&a&&t.jsx("div",{role:"button",onClick:u=>s(e.id,u),className:"relative z-20 ml-1.5 p-0.5 rounded-full hover:bg-slate-200/80 dark:hover:bg-slate-600 text-slate-400 hover:text-rose-500 transition-colors",children:t.jsx("span",{className:"material-icons !text-[14px] block",children:"close"})})]},e.id)})})};export{g as U};
