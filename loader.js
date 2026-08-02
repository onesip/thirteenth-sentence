(async()=>{
  const load=async(url)=>{
    const response=await fetch(url,{cache:"force-cache"});
    if(!response.ok) throw new Error(`资源读取失败：${url}`);
    if(typeof DecompressionStream!=="function") throw new Error("当前浏览器版本过旧，请使用最新版 Chrome、Edge 或 Safari。 ");
    const stream=response.body.pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  };
  try{
    const [css,js]=await Promise.all([load("/assets/styles.css.gz"),load("/assets/game.js.gz")]);
    const style=document.createElement("style"); style.textContent=css; document.head.appendChild(style);
    Function(js)();
  }catch(error){
    console.error(error);
    document.body.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;background:#17141b;color:#eee7eb;font-family:system-ui;padding:32px;text-align:center"><div><h1 style="font-family:serif;font-weight:400">档案暂时无法展开</h1><p style="opacity:.65;line-height:1.8">${String(error.message||error)}</p></div></main>`;
  }
})();
