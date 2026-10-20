import { Injectable } from '@nestjs/common';
@Injectable()
export class TranscriptionService {
 async transcribe(audio:Buffer):Promise<string> {
  const key=process.env.OPENAI_API_KEY;
  if(!key) throw new Error('OPENAI_API_KEY missing');
  const form=new FormData();
  const audioBytes = new Uint8Array(audio.length);
  audioBytes.set(audio);
  form.append('file', new Blob([audioBytes], {type:'audio/wav'}), 'message.wav');
  form.append('model',process.env.OPENAI_TRANSCRIPTION_MODEL||'gpt-4o-mini-transcribe');
  form.append('response_format','json');
  const res=await fetch('https://api.openai.com/v1/audio/transcriptions',{
   method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(30000)
  });
  if(!res.ok) throw new Error(`Transcription HTTP ${res.status}: ${(await res.text()).slice(0,300)}`);
  const json:any=await res.json();
  return String(json.text??'').trim();
 }
}
