import { Controller,Post,Req,HttpCode,ForbiddenException,Logger } from '@nestjs/common';
import { Request } from 'express';
import { createPublicKey,verify } from 'node:crypto';
import { ScreeningService } from '../screening/screening.service';
import { CallsService } from '../calls/calls.service';
@Controller('webhooks/telnyx')
export class TelnyxController {
 private readonly logger=new Logger(TelnyxController.name);
 constructor(private readonly screening:ScreeningService,private readonly calls:CallsService){}
 private verifyWebhook(req:Request){
  if(process.env.ALLOW_UNSIGNED_WEBHOOKS==='true' && process.env.NODE_ENV!=='production')return true;
  const sig=req.header('telnyx-signature-ed25519'); const stamp=req.header('telnyx-timestamp');
  const key=process.env.TELNYX_PUBLIC_KEY;
  if(!sig||!stamp||!key||!/^\d+$/.test(stamp)||Math.abs(Date.now()/1000-Number(stamp))>300)return false;
  const raw=(req as Request & {rawBody?:Buffer}).rawBody;
  if(!raw)return false;
  try {
   const der=Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(key,'base64')]);
   const pub=createPublicKey({key:der,format:'der',type:'spki'});
   return verify(null,Buffer.concat([Buffer.from(stamp+'|'),raw]),pub,Buffer.from(sig,'base64'));
  }catch{return false;}
 }
 @Post() @HttpCode(200)
 async webhook(@Req() req:Request){
  if(!this.verifyWebhook(req)) throw new ForbiddenException('Invalid Telnyx signature');
  const data=(req.body as any)?.data;
  if(!data?.id||!data?.event_type||!data?.payload) return {ok:false};
  if(!(await this.calls.uniqueEvent(data.id,data.event_type)))return {ok:true,duplicate:true};
  const p=data.payload;
  try {
   switch(data.event_type){
    case 'call.initiated': await this.screening.initiated(p);break;
    case 'call.answered':await this.screening.answered(p);break;
    case 'call.recording.saved': {
      const urls=p.recording_urls||{};
      const url=String(urls.wav||p.recording_url||'');
      const recordingId=String(p.recording_id||p.recording_id_uuid||data.id);
      if(url && p.call_control_id) {
        const turn=await this.screening.recordingSaved(p);
        await this.calls.queueRecording(recordingId,String(p.call_control_id),url,turn);
      } else this.logger.warn('Recording saved event missing URL or call ID');
      break;
    }
    case 'call.recording.error':this.logger.error(`Recording failed for ${p.call_control_id}`);break;
    case 'call.speak.ended':await this.screening.spoke(p);break;
    case 'call.conversation.ended': this.logger.log(`Conversation relay ended: ${String(p.reason || '')}`); break;
    case 'call.hangup':await this.calls.end(p.call_control_id);break;
   }
  }catch(e){this.logger.error(`Event ${data.id} failed`,e instanceof Error?e.stack:String(e));throw e;}
  return {ok:true};
 }
}
