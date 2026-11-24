import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import OpenAI from 'openai';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=process.env.PORT||3000;
app.use(helmet({contentSecurityPolicy:false}));
app.set('trust proxy',1);
app.use(cookieParser());
app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'public')));
const sessions=new Map();
const systemPrompt=`You are the Truth Be Told AI host, a compassionate, grounded guide discussing the life and teachings of Jesus, biblical texts, history, faith, life, relationships, family, society, science, and the future. You are an AI character inspired by Jesus' teachings, NOT Jesus, God, a prophet, or a source of revelation. Never claim divine authority, supernatural access, personal memories of biblical events, or infallibility. Separate: (1) what biblical texts say, (2) what historians commonly infer, (3) what Christian traditions believe, and (4) what is uncertain. For Jesus' life cover first-century Jewish context, Gospel birth/childhood accounts, baptism and ministry, parables and disciples, final days in Jerusalem, crucifixion under Pontius Pilate, resurrection belief and early Christian proclamation, historical legacy through 2026, and future biblical interpretations. State that exact birth date/year is uncertain. Distinguish Christian resurrection faith from what historical methods can independently establish. For end-times questions explain differing interpretations, never set dates or claim current events prove prophecy. Be warm, respectful, direct, nonjudgmental. Do not invent scripture quotations or references. Cite book/chapter/verse when confidently known. Answer the user's question directly.`;
function userFrom(req){const token=req.cookies.ttb_session;return token?sessions.get(token):null;}
app.get('/api/health',(_,res)=>res.json({ok:true,app:'Truth Be Told',cashAppConfigured:true,aiConfigured:Boolean(process.env.OPENAI_API_KEY),authMode:'temporary-email-session',persistentStorage:false}));
app.get('/api/session',(req,res)=>{const user=userFrom(req);if(!user)return res.status(401).json({authenticated:false});res.json({authenticated:true,email:user.email,subscribed:false});});
app.post('/api/session', (req,res)=>{const email=String(req.body?.email||'').trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Enter a valid email.'});const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{email,createdAt:Date.now()});res.cookie('ttb_session',token,{httpOnly:true,secure:req.secure || req.get('x-forwarded-proto')==='https',sameSite:'lax',maxAge:30*864e5});res.json({ok:true,email,subscribed:false});});
app.delete('/api/session',(req,res)=>{const t=req.cookies.ttb_session;if(t)sessions.delete(t);res.clearCookie('ttb_session');res.json({ok:true});});
app.post('/api/chat',async(req,res)=>{const user=userFrom(req);if(!user)return res.status(401).json({error:'Sign in to continue.'});if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'AI service is not configured yet. Add OPENAI_API_KEY in the service environment.'});const question=String(req.body?.message||'').trim();if(!question||question.length>5000)return res.status(400).json({error:'Enter a question up to 5,000 characters.'});try{const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});const completion=await ai.chat.completions.create({model:process.env.OPENAI_MODEL||'gpt-4o-mini',messages:[{role:'system',content:systemPrompt},{role:'user',content:question}],temperature:.6,max_tokens:900});res.json({answer:completion.choices[0]?.message?.content||'I could not form an answer just now.'});}catch(e){const status=Number(e?.status)||0;const code=String(e?.code||'');const type=String(e?.type||'');console.error('OpenAI chat failure',JSON.stringify({status,code,type,message:String(e?.message||'Unknown error'),requestId:e?.request_id||e?.requestID||null}));let message='The AI service had a temporary problem. Please try again in a moment.';if(status===401||status=== 403){message='OpenAI rejected the API key or its permissions. In Render, check that OPENAI_API_KEY is the current valid Secret API key.';}else if(status===429){message='OpenAI rate limit or usage limit reached. Check API billing, available credits, and project limits.';}else if(status===404){message='The configured OpenAI model is unavailable for this API project. Check OPENAI_MODEL in Render or remove it to use the default model.';}res.status(502).json({error:message});}});

app.post('/api/chat/stream',async(req,res)=>{
  const user=userFrom(req);
  if(!user)return res.status(401).json({error:'Sign in to continue.'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'AI service is not configured yet. Add OPENAI_API_KEY in the service environment.'});
  const question=String(req.body?.message||'').trim();
  if(!question||question.length>5000)return res.status(400).json({error:'Enter a question up to 5,000 characters.'});
  const hist=(Array.isArray(req.body?.history)?req.body.history:[]).slice(-10).filter(m=>m&&(m.role==='user'||m.role==='assistant')&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,2000)}));
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform',Connection:'keep-alive','X-Accel-Buffering':'no'});
  res.flushHeaders?.();
  const send=o=>res.write('data: '+JSON.stringify(o)+'\n\n');
  try{
    const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const stream=await ai.chat.completions.create({model:process.env.OPENAI_MODEL||'gpt-4o-mini',stream:true,temperature:.6,max_tokens:700,messages:[{role:'system',content:systemPrompt+' Speak warmly and conversationally in short spoken-style paragraphs, in the gentle, parable-rich spirit of the Gospel teachings, because answers are read aloud. You remain an AI character and say so plainly if asked who you are.'},...hist,{role:'user',content:question}]});
    for await(const part of stream){const t=part.choices?.[0]?.delta?.content;if(t)send({t});}
    send({done:true});
  }catch(e){
    const status=Number(e?.status)||0;
    console.error('OpenAI stream failure',JSON.stringify({status,message:String(e?.message||'Unknown error')}));
    send({error:status===401||status===403?'OpenAI rejected the API key. Check OPENAI_API_KEY in Render.':status===429?'OpenAI usage limit reached. Check API billing and credits.':'The AI service had a temporary problem. Please try again.'});
  }
  res.end();
});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log('Truth Be Told listening on '+PORT));