import{R as p,j as e}from"./index-ZXlslG1z.js";const f=p.forwardRef(({id:r,value:d,onChange:i,options:o=[],placeholder:l,icon:s,disabled:n=!1,className:u="",wrapperClassName:c="",error:t,children:b,...x},m)=>e.jsxs("div",{className:`relative group ${c}`,children:[s&&e.jsx("div",{className:"pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 transition-colors duration-300 text-slate-400 group-focus-within:text-blue-600 dark:text-slate-500 dark:group-focus-within:text-blue-400",children:e.jsx("span",{className:"material-icons !text-lg",children:s})}),e.jsxs("select",{id:r,value:d,onChange:i,disabled:n,ref:m,className:`
            w-full appearance-none rounded-xl border-2 
            bg-white dark:bg-slate-950 
            py-3.5 pr-10 text-sm font-medium 
            text-slate-900 dark:text-slate-100 
            shadow-sm transition-all duration-200 ease-out
            
            ${t?"border-red-300 dark:border-red-800/50 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-900/30":"border-slate-200 dark:border-slate-800 focus:border-blue-600 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20"}

            focus:outline-none 
            disabled:bg-slate-50 dark:disabled:bg-slate-900/50 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:border-slate-100 dark:disabled:border-slate-800 disabled:cursor-not-allowed
            ${s?"pl-11":"pl-4"} 
            ${u}
        `,...x,children:[l&&e.jsx("option",{value:"",disabled:!0,className:"text-slate-400 bg-white dark:bg-slate-950",children:l}),o.map(a=>e.jsx("option",{value:a.value,className:"bg-white dark:bg-slate-950",children:a.label},a.value)),b]}),e.jsx("div",{className:"pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 dark:text-slate-600 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400",children:e.jsx("span",{className:"material-icons !text-xl",children:"expand_more"})}),t&&e.jsx("span",{className:"text-xs text-red-500 mt-1 ml-1",children:t})]}));f.displayName="Select";export{f as S};
