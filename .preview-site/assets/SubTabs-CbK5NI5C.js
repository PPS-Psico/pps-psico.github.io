import{c as w,j as a,m as j}from"./index-Bf63COEH.js";const N=i=>{const e=w.c(18),{tabs:d,activeTabId:r,onTabChange:n,layoutIdPrefix:p,className:f,variant:c,onTabClose:s}=i,o=p===void 0?"tabs":p,x=f===void 0?"":f,t=c===void 0?"primary":c,b=t==="primary"?`
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
          `,h=t==="primary"?"text-slate-900 dark:text-white":"text-slate-800 dark:text-slate-100",k=`inline-flex items-center justify-start max-w-full overflow-x-auto no-scrollbar ${b} ${x}`;let m;if(e[0]!==r||e[1]!==h||e[2]!==o||e[3]!==n||e[4]!==s||e[5]!==d||e[6]!==t){let v;e[8]!==r||e[9]!==h||e[10]!==o||e[11]!==n||e[12]!==s||e[13]!==t?(v=l=>{const u=r===l.id;return a.jsxs("button",{role:"tab","aria-selected":u,onClick:()=>n(l.id,l.path),className:`
                            relative flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition duration-300 outline-none whitespace-nowrap z-10 flex-shrink-0
                            ${t==="primary"?"rounded-full":"rounded-xl"}
                            ${u?h:"text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}
                        `,style:{WebkitTapHighlightColor:"transparent"},children:[u&&a.jsx(j.div,{layoutId:`${o}-pill`,className:`
                                    absolute inset-0
                                    bg-white dark:bg-slate-600/80
                                    ${t==="primary"?"shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-none ring-1 ring-black/5 dark:ring-white/10 rounded-full":"rounded-xl shadow-sm"}
                                `,transition:{type:"spring",stiffness:400,damping:30}}),l.icon&&a.jsx("span",{className:`material-icons relative z-20 !text-[18px] transition-colors duration-300 ${u?"text-blue-600 dark:text-blue-400":"opacity-70"}`,children:l.icon}),a.jsx("span",{className:"relative z-20",children:l.label}),l.badge&&a.jsx("span",{className:`
                                relative z-20 ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] leading-none
                                ${u?"bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200":"bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}
                             `,children:l.badge}),s&&u&&a.jsx("div",{role:"button",onClick:y=>s(l.id,y),className:"relative z-20 ml-1.5 p-0.5 rounded-full hover:bg-slate-200/80 dark:hover:bg-slate-600 text-slate-400 hover:text-rose-500 transition-colors",children:a.jsx("span",{className:"material-icons !text-[14px] block",children:"close"})})]},l.id)},e[8]=r,e[9]=h,e[10]=o,e[11]=n,e[12]=s,e[13]=t,e[14]=v):v=e[14],m=d.map(v),e[0]=r,e[1]=h,e[2]=o,e[3]=n,e[4]=s,e[5]=d,e[6]=t,e[7]=m}else m=e[7];let g;return e[15]!==k||e[16]!==m?(g=a.jsx("div",{role:"tablist",className:k,children:m}),e[15]=k,e[16]=m,e[17]=g):g=e[17],g},C=i=>{const e=w.c(10),{tabs:d,activeTabId:r,onTabChange:n,className:p}=i,f=p===void 0?"":p;let c;e[0]!==d?(c=d.map($),e[0]=d,e[1]=c):c=e[1];const s=c,o=`relative w-full flex justify-start md:justify-center overflow-x-auto ${f}`;let x;e[2]===Symbol.for("react.memo_cache_sentinel")?(x=a.jsx("div",{className:"absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none z-20 md:hidden"}),e[2]=x):x=e[2];let t;e[3]!==r||e[4]!==s||e[5]!==n?(t=a.jsx(N,{tabs:s,activeTabId:r,onTabChange:n,layoutIdPrefix:"subtabs",variant:"secondary"}),e[3]=r,e[4]=s,e[5]=n,e[6]=t):t=e[6];let b;return e[7]!==o||e[8]!==t?(b=a.jsxs("div",{className:o,children:[x,t]}),e[7]=o,e[8]=t,e[9]=b):b=e[9],b};function $(i){return{id:i.id,label:i.label,icon:i.icon}}export{C as S};
