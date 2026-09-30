import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const API_KEY = process.env.OPENAI_API_KEY;

const knowledge = JSON.parse(
  await fs.readFile(path.join(__dirname, "knowledge.json"), "utf8")
);

const SYSTEM = `أنت "مساعد كلية التكنولوجيا والتعليم الصناعي بجامعة سوهاج".
مهمتك الإجابة على أسئلة الطلاب اعتمادًا فقط على قاعدة المعرفة التالية.
قواعد صارمة:
1) لا تخترع أي معلومة غير موجودة في قاعدة المعرفة.
2) إذا لم توجد الإجابة، قل بوضوح: "المعلومة دي غير موجودة حاليًا في قاعدة المعرفة."
3) لا تستخدم الويب ولا معلوماتك العامة لإكمال النقص.
4) لا تغيّر أسماء الأقسام أو الشعب الواردة في القاعدة.
5) أجب بالعربية المصرية البسيطة والمباشرة، إلا إذا طلب الطالب أسلوبًا آخر.
6) إذا كان السؤال يحتاج تفاصيل غير موجودة، اذكر المتاح فقط ووضح أن التفاصيل غير مضافة بعد.

قاعدة المعرفة:
${JSON.stringify(knowledge, null, 2)}
`;

async function askOpenAI(question) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: SYSTEM,
      input: question,
      max_output_tokens: 350
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI API error");
  }

  // Responses API commonly exposes a convenience output_text field.
  if (typeof data.output_text === "string") return data.output_text;

  // Fallback parser for output message/content blocks.
  const chunks = [];
  for (const item of (data.output || [])) {
    for (const part of (item.content || [])) {
      if (part.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n").trim() || "لم أجد إجابة متاحة في قاعدة المعرفة.";
}

function send(res, status, body, type="application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

const mime = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8"
};

const server = http.createServer(async (req,res)=>{
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST,GET,OPTIONS"});
      return res.end();
    }

    if (req.method === "GET" && req.url === "/api/health") {
      return send(res, 200, JSON.stringify({ok:true, service:"sohag-tech-edu-ai"}));
    }

    if (req.method === "POST" && req.url === "/api/chat") {
      if (!API_KEY) return send(res, 500, JSON.stringify({error:"OPENAI_API_KEY غير مضبوط على الخادم."}));
      let raw="";
      for await (const chunk of req) raw += chunk;
      const {question} = JSON.parse(raw || "{}");
      if (!question || typeof question !== "string") {
        return send(res,400,JSON.stringify({error:"السؤال مطلوب."}));
      }
      if (question.length > 1200) {
        return send(res,413,JSON.stringify({error:"السؤال طويل جدًا."}));
      }
      const answer = await askOpenAI(question);
      return send(res,200,JSON.stringify({answer}));
    }

    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath="/index.html";
    const filePath = path.normalize(path.join(__dirname,urlPath));
    if (!filePath.startsWith(__dirname)) return send(res,403,"Forbidden","text/plain; charset=utf-8");
    const ext=path.extname(filePath);
    const content=await fs.readFile(filePath);
    res.writeHead(200,{"Content-Type":mime[ext] || "application/octet-stream"});
    res.end(content);
  } catch(e) {
    console.error(e);
    send(res,500,JSON.stringify({error:"حدث خطأ داخلي في الخادم."}));
  }
});

server.listen(PORT,()=>console.log(`Platform running on http://localhost:${PORT}`));
