import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class CallsService {
 constructor(private readonly db:DataSource) {}
 async uniqueEvent(id:string,type:string):Promise<boolean> {
  const result:any=await this.db.query('INSERT IGNORE INTO webhook_events (event_id,event_type) VALUES (?,?)',[id,type]);
  return result.affectedRows>0;
 }
 async create(userId:number,controlId:string,from:string,to:string,contactId:number|null,decision:string) {
  await this.db.query('INSERT IGNORE INTO calls (user_id,call_control_id,from_e164,to_e164,contact_id,decision) VALUES (?,?,?,?,?,?)',[userId,controlId,from,to,contactId,decision]);
 }
 async stateIfActive(id:string,status:string) {
  await this.db.query("UPDATE calls SET status=? WHERE call_control_id=? AND status NOT IN ('HUNG_UP','ERROR')",[status,id]);
 }
 async decision(id:string):Promise<string> {const r:any[]=await this.db.query('SELECT decision FROM calls WHERE call_control_id=? LIMIT 1',[id]);return r[0]?.decision??'UNKNOWN';}
 async phase(id:string):Promise<string> {const r:any[]=await this.db.query('SELECT processing_phase FROM calls WHERE call_control_id=? LIMIT 1',[id]);return r[0]?.processing_phase??'';}
 async setPhase(id:string,phase:string) {await this.db.query('UPDATE calls SET processing_phase=? WHERE call_control_id=?',[phase,id]);}
 async isEnded(id:string):Promise<boolean> {const r:any[]=await this.db.query('SELECT status FROM calls WHERE call_control_id=? LIMIT 1',[id]);return r[0]?.status==='HUNG_UP';}
 async callerContext(id:string):Promise<any> {const r:any[]=await this.db.query('SELECT contact_id,decision FROM calls WHERE call_control_id=? LIMIT 1',[id]);return r[0]??null;}
 async end(id:string) {await this.db.query("UPDATE calls SET status='HUNG_UP',ended_at=COALESCE(ended_at,CURRENT_TIMESTAMP) WHERE call_control_id=?",[id]);}
 async queueRecording(recordingId:string,callId:string,url:string,turn:number) {
  await this.db.query("INSERT IGNORE INTO recording_jobs (recording_id,call_control_id,recording_url,turn_number,status) VALUES (?,?,?,?,'QUEUED')",[recordingId,callId,url,turn]);
 }
 async transcriptLanguage(id:string):Promise<string> {const rows:any[]=await this.db.query('SELECT transcript_language FROM calls WHERE call_control_id=? LIMIT 1',[id]);return String(rows[0]?.transcript_language||'unknown');}
 async previousTranscript(id:string):Promise<string> {const rows:any[]=await this.db.query('SELECT transcript_original FROM calls WHERE call_control_id=? LIMIT 1',[id]);return String(rows[0]?.transcript_original||'');}
 async recordRelayTranscript(id:string, transcript:string, lang:string, assessment:{category:string;priority:string;decision:string;summary:string;source:string;language:string;confidence:number}) {
  // Preserve multiple caller turns in their original language, not only the most recent turn.
  await this.db.query(`UPDATE calls SET transcript_original=?,transcript_language=?,reason_text=?,category=?,priority=?,decision=?,ai_summary=?,classification_source=?,detected_language=?,classification_confidence=? WHERE call_control_id=?`,
   [transcript.slice(0,6000),lang,transcript.slice(0,3000),assessment.category,assessment.priority,assessment.decision,assessment.summary,assessment.source,lang,assessment.confidence,id]);
 }
 async recordTranscription(id:string,transcript:string,language:string,assessment:{category:string;priority:string;decision:string;summary:string;source:string;language:string;confidence:number}) {
  await this.db.query(`UPDATE calls SET transcript_original=?,transcript_language=?,reason_text=?,category=?,priority=?,decision=?,ai_summary=?,classification_source=?,detected_language=?,classification_confidence=? WHERE call_control_id=?`,
   [transcript.slice(0,6000),language,transcript.slice(0,3000),assessment.category,assessment.priority,assessment.decision,assessment.summary,assessment.source,assessment.language,assessment.confidence,id]);
 }
}
