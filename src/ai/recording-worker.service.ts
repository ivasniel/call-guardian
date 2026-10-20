import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { CallsService } from '../calls/calls.service';
import { ClassificationService } from './classification.service';
import { TranscriptionService } from './transcription.service';
import { ScreeningService } from '../screening/screening.service';

@Injectable()
export class RecordingWorkerService implements OnModuleInit,OnModuleDestroy {
 private readonly logger=new Logger(RecordingWorkerService.name);
 private timer?:ReturnType<typeof setInterval>;
 private busy=false;
 constructor(private readonly db:DataSource,private readonly calls:CallsService,private readonly classification:ClassificationService,private readonly transcription:TranscriptionService,private readonly screening:ScreeningService) {}
 onModuleInit(){
  // Recover jobs left PROCESSING by an interrupted local worker.
  void this.db.query("UPDATE recording_jobs SET status='QUEUED' WHERE status='PROCESSING' AND attempts<3").catch(e=>this.logger.error(String(e)));
  this.timer=setInterval(()=>{void this.tick();},5000);
 }
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 private async fetchAudio(raw:string):Promise<Buffer> {
  const url=new URL(raw);
  if(url.protocol!=='https:' || url.port || url.username || url.password)throw new Error('Unsafe recording URL');
  const allowed=(process.env.TELNYX_RECORDING_HOSTS||'telnyx.com,amazonaws.com,googleapis.com').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  const host=url.hostname.toLowerCase();
  if(!allowed.some(x=>host===x||host.endsWith('.'+x)))throw new Error(`Recording host not allowlisted: ${host}`);
  if(isIP(host))throw new Error('IP literal not permitted');
  // Reject private/address-local DNS responses. The HTTP client may resolve separately;
  // host allowlisting is the primary safeguard, and deployment egress rules are recommended.
  const addresses=await lookup(host,{all:true});
  if(!addresses.length||addresses.some(a=>a.address.startsWith('127.')||a.address.startsWith('10.')||a.address.startsWith('192.168.')||a.address.startsWith('169.254.')||a.address==='::1'||a.address.startsWith('fc')||a.address.startsWith('fd')))throw new Error('Unsafe recording DNS');
  const res=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw new Error(`Recording download HTTP ${res.status}`);
  const size=Number(res.headers.get('content-length')||0);
  const max=Number(process.env.RECORDING_MAX_BYTES||12000000);
  if(size>max)throw new Error('Recording exceeds maximum bytes');
  const reader=res.body?.getReader();if(!reader)throw new Error('Empty recording response');
  const chunks:Uint8Array[]=[];let total=0;
  try { while(true){const r=await reader.read();if(r.done)break;total+=r.value.byteLength;if(total>max)throw new Error('Recording too large');chunks.push(r.value);} }
  finally { await reader.cancel().catch(()=>{}); }
  return Buffer.concat(chunks.map(c=>Buffer.from(c)));
 }
 private async tick(){
  if(this.busy)return;this.busy=true;
  try {
   const rows:any[]=await this.db.query("SELECT * FROM recording_jobs WHERE status='QUEUED' AND attempts<3 ORDER BY id LIMIT 1");
   const job=rows[0];if(!job)return;
   await this.db.query("UPDATE recording_jobs SET status='PROCESSING',attempts=attempts+1 WHERE id=? AND status='QUEUED'",[job.id]);
   try{
    const audio=await this.fetchAudio(job.recording_url);
    const transcript=await this.transcription.transcribe(audio);
    if(!transcript)throw new Error('Empty transcription');
    const turn=Number(job.turn_number||1);
    const prior=turn===2?await this.calls.previousTranscript(job.call_control_id):'';
    const combined=[prior,transcript].filter(Boolean).join('\n').slice(0,6000);
    const ctx=await this.calls.callerContext(job.call_control_id);
    const result=await this.classification.assess(combined,Boolean(ctx?.contact_id));
    // On turn 2, respect the language established by the first utterance.
    const firstLanguage=turn===2?await this.calls.transcriptLanguage(job.call_control_id):'unknown';
    const language=(firstLanguage==='es'||firstLanguage==='en')?firstLanguage:
      result.language==='es'?'es':result.language==='en'?'en':
      /[áéíóúñ¿¡]|\b(hola|buenos|llamo|hablar|estoy|necesito|gracias|para|quiero|soy|porque|escuela|colegio)\b/i.test(combined)?'es':'en';
    await this.calls.recordTranscription(job.call_control_id,combined,language,result);
    await this.db.query("UPDATE recording_jobs SET status='DONE',processed_at=NOW(),last_error=NULL WHERE id=?",[job.id]);
    try { await this.screening.onTranscript(job.call_control_id,turn,combined,result,language); }
    catch(speechError) { this.logger.warn(`Audio reply unavailable for job ${job.id}: ${String(speechError)}`); }
    this.logger.log(`Recording ${job.id} transcribed: ${result.category}/${result.priority} (${result.language})`);
   }catch(err){
    const message=String(err).slice(0,500);
    await this.db.query("UPDATE recording_jobs SET status=IF(attempts<3,'QUEUED','ERROR'),last_error=? WHERE id=?",[message,job.id]);
    this.logger.error(`Recording job ${job.id}: ${message}`);
   }
  }catch(err){this.logger.error(`Recording poll failed: ${String(err)}`);}finally{this.busy=false;}
 }
}
