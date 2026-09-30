const messages=document.getElementById("messages");
const form=document.getElementById("chatForm");
const input=document.getElementById("question");

function addMessage(text, cls){
  const el=document.createElement("div");
  el.className=`msg ${cls}`;
  el.textContent=text;
  messages.appendChild(el);
  messages.scrollTop=messages.scrollHeight;
  return el;
}

async function send(q){
  q=q.trim();
  if(!q) return;
  addMessage(q,"user-msg");
  input.value="";
  const pending=addMessage("جاري التفكير...","bot-msg");
  try{
    const res=await fetch("/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({question:q})
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.error || "حدث خطأ");
    pending.textContent=data.answer;
  }catch(err){
    pending.textContent="حصلت مشكلة في الاتصال بالمساعد. تأكدي أن الخادم يعمل وأن مفتاح الـAPI مضبوط.";
  }
}
form.addEventListener("submit",e=>{e.preventDefault();send(input.value)});
document.querySelectorAll(".suggestions button").forEach(b=>b.addEventListener("click",()=>send(b.dataset.q)));
