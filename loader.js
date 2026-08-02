(async()=>{
  const ungzip=async(bytes)=>{
    if(typeof DecompressionStream!=="function") throw new Error("当前浏览器版本过旧，请使用最新版 Chrome、Edge 或 Safari。");
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  };
  const loadBinaryGzip=async(url)=>{
    const response=await fetch(url,{cache:"force-cache"});
    if(!response.ok) throw new Error(`资源读取失败：${url}`);
    return ungzip(await response.arrayBuffer());
  };
  const loadText=async(url)=>{
    const response=await fetch(url,{cache:"force-cache"});
    if(!response.ok) throw new Error(`资源读取失败：${url}`);
    return response.text();
  };
  const decodeBase64=async(text)=>{
    const binary=atob(String(text||"").replace(/\s+/g,""));
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return ungzip(bytes);
  };
  try{
    const [baseCss,v2Css,...parts]=await Promise.all([
      loadBinaryGzip("/assets/styles.css.gz"),
      loadText("/assets/v2-styles.css.gz.b64?v=3").then(decodeBase64),
      loadText("/assets/game-v2.part1.txt?v=3"),
      loadText("/assets/game-v2.part2.txt?v=3"),
      loadText("/assets/game-v2.part3.txt?v=3"),
      loadText("/assets/game-v2.part4.txt?v=3")
    ]);
    const game=await decodeBase64(parts.join(""));
    const style=document.createElement("style");
    style.textContent=baseCss+"\n"+v2Css;
    document.head.appendChild(style);
    Function(game)();
  }catch(error){
    console.error(error);
    document.body.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;background:#17141b;color:#eee7eb;font-family:system-ui;padding:32px;text-align:center"><div><h1 style="font-family:serif;font-weight:400">档案暂时无法展开</h1><p style="opacity:.65;line-height:1.8">${String(error.message||error)}</p></div></main>`;
  }
})();
