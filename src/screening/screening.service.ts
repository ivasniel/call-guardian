import { Injectable, Logger } from '@nestjs/common';
import { ContactsService } from '../contacts/contacts.service';
import { CallsService } from '../calls/calls.service';
import { TelnyxService, TelnyxCallEndedError } from '../telnyx/telnyx.service';
import type { Assessment } from '../ai/classification.service';

type Lang = 'en'|'es';
@Injectable()
export class ScreeningService {
  private readonly logger = new Logger(ScreeningService.name);
  constructor(private readonly contacts: ContactsService, private readonly calls: CallsService, private readonly telnyx: TelnyxService) {}
  private async safe(id:string, command:()=>Promise<void>):Promise<boolean> {
    if(await this.calls.isEnded(id))return false;
    try { await command(); return true; }
    catch(e){if(e instanceof TelnyxCallEndedError){this.logger.debug(`Call already ended ${id}`);return false;}throw e;}
  }
  async initiated(p:any) {
    if(p.direction && p.direction!=='incoming')return;
    const id=String(p.call_control_id??''), to=String(p.to??''), from=String(p.from??'');
    if(!id)return;
    const userId=await this.contacts.resolveDestination(to);
    if(!userId){this.logger.error(`Unassigned Telnyx number ${to}`);return;}
    const contact=await this.contacts.find(userId,from);
    const decision=contact?.classification==='BLOCKED'?'BLOCKED':contact?'KNOWN':'UNKNOWN';
    await this.calls.create(userId,id,from,to,contact?.id??null,decision);
    await this.safe(id,()=>this.telnyx.answer(id));
  }
  async answered(p:any) {
    const id=String(p.call_control_id??'');if(!id||await this.calls.isEnded(id))return;
    await this.calls.stateIfActive(id,'ANSWERED');
    const decision=await this.calls.decision(id);
    if(decision==='BLOCKED') {
      await this.calls.setPhase(id,'ENDING');
      await this.safe(id,()=>this.telnyx.speak(id,'This line is unavailable. Goodbye.'));
      return;
    }
    if(process.env.SCREENING_MODE==='RELAY') {
      await this.calls.setPhase(id,'RELAY');
      try { await this.safe(id,()=>this.telnyx.startRelay(id)); }
      catch(e) { this.logger.error(`Relay start failed ${id}: ${String(e)}`); await this.calls.setPhase(id,'ERROR'); await this.safe(id,()=>this.telnyx.hangup(id)); }
      return;
    }
    await this.calls.setPhase(id,'GREETING');
    // TEST ONLY: no automatic recording-disclosure here. See README privacy/consent section.
    const greeting=process.env.INITIAL_GREETING || 'Hello?';
    await this.safe(id,()=>this.telnyx.speak(id,greeting));
  }
  async spoke(p:any) {
    const id=String(p.call_control_id??'');if(!id||await this.calls.isEnded(id))return;
    const phase=await this.calls.phase(id);
    if(phase==='GREETING'||phase==='QUESTION') {
      const turn=phase==='GREETING'?1:2;
      await this.calls.setPhase(id,`RECORDING_${turn}`);
      try { await this.safe(id,()=>this.telnyx.startRecording(id)); }
      catch(e){this.logger.error(`Start recording ${id}: ${String(e)}`);await this.calls.setPhase(id,'ERROR');await this.safe(id,()=>this.telnyx.hangup(id));}
    } else if(phase==='ENDING') {
      await this.safe(id,()=>this.telnyx.hangup(id));
    }
  }
  async recordingSaved(p:any):Promise<number> {
    const id=String(p.call_control_id??'');if(!id)return 1;
    const phase=await this.calls.phase(id);
    const turn=phase==='RECORDING_2'?2:1;
    // A recording can be saved after hangup: the worker still persists its transcript.
    if(phase===`RECORDING_${turn}` && !await this.calls.isEnded(id)) {
      await this.calls.setPhase(id,`WAITING_${turn}`);
      this.logger.log(`Recording saved, processing turn ${turn} for ${id}`);
    }
    return turn;
  }
  async onTranscript(id:string,turn:number,transcript:string,assessment:Assessment,language:Lang):Promise<void> {
    if(await this.calls.isEnded(id))return;
    const phase=await this.calls.phase(id);
    if(phase!==`WAITING_${turn}`)return;
    // Ask at most once. A generic greeting or vague message is insufficient to identify the call.
    const needsClarification=turn===1 && (
      assessment.category==='UNKNOWN' ||
      transcript.trim().split(/\s+/).length<4
    );
    if(needsClarification){
      await this.calls.setPhase(id,'QUESTION');
      const question=language==='es'
        ? '¿Me puede decir su nombre y el motivo de su llamada?'
        : 'May I have your name and the reason for your call?';
      await this.safe(id,()=>this.telnyx.speak(id,question,language));
    } else {
      await this.calls.setPhase(id,'ENDING');
      const goodbye=language==='es'?'Gracias. He recibido su mensaje.':'Thank you. I have your message.';
      await this.safe(id,()=>this.telnyx.speak(id,goodbye,language));
    }
  }
}
