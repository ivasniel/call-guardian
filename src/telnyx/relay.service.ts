import { Injectable, Logger } from '@nestjs/common';
import { WebSocketServer, WebSocket } from 'ws';
import { Server, IncomingMessage } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ClassificationService } from '../ai/classification.service';
import { CallsService } from '../calls/calls.service';
import { TelnyxService, TelnyxCallEndedError }
  from './telnyx.service';

type Language = 'es'|'en';
interface Session { id:string; lang?:Language; turns:string[]; busy:boolean; pending:string[]; asking:boolean; }
@Injectable()
export class RelayService {
 private readonly log = new Logger(RelayService.name);
 constructor(private readonly calls:CallsService,private readonly classifier:ClassificationService, 
  private readonly telnyx: TelnyxService,) {}

attach(server: Server): void {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024,
  });

  type AuthenticatedRequest = IncomingMessage & {
    relayCallId?: string;
  };

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const reject = () => socket.destroy();

    void (async () => {
      const url = new URL(req.url || '/', 'http://localhost');

      if (url.pathname !== '/relay') {
        reject();
        return;
      }

      const id = url.searchParams.get('call') || '';
      const expires = url.searchParams.get('expires') || '';
      const signature = url.searchParams.get('signature') || '';

      const secret = process.env.RELAY_SHARED_SECRET || '';

      const expiration = Number(expires);
      const now = Math.floor(Date.now() / 1000);

      if (
        !id ||
        secret.length < 24 ||
        !/^\d+$/.test(expires) ||
        !Number.isSafeInteger(expiration) ||
        expiration < now ||
        expiration > now + 300 ||
        !/^[a-f0-9]{64}$/i.test(signature)
      ) {
        this.log.warn('Relay authentication rejected');
        reject();
        return;
      }

      const expected = createHmac('sha256', secret)
        .update(`${id}:${expires}`)
        .digest();

      const supplied = Buffer.from(signature, 'hex');

      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      ) {
        this.log.warn('Relay signature invalid');
        reject();
        return;
      }

      // Asegurarnos de que sea una llamada activa
      // que realmente está esperando Conversation Relay.
      if (
        await this.calls.phase(id) !== 'RELAY' ||
        await this.calls.isEnded(id)
      ) {
        this.log.warn('Relay call not active');
        reject();
        return;
      }

      (req as AuthenticatedRequest).relayCallId = id;

      wss.handleUpgrade(req, socket, head, ws => {
        wss.emit('connection', ws, req);
      });
    })().catch(error => {
      this.log.error(
        `Relay upgrade error: ${String(error)}`
      );

      reject();
    });
  });

  wss.on('connection', (
    ws: WebSocket,
    req: AuthenticatedRequest,
  ) => {
    const callId = req.relayCallId;

    if (!callId) {
      ws.close(1008, 'Unauthenticated');
      return;
    }

    this.log.log('RELAY: WebSocket authenticated');

    const session: Session = {
      id: callId,
      turns: [],
      busy: false,
      pending: [],
      asking: false,
    };

    ws.on('message', raw => {
      let frame: any;

      try {
        frame = JSON.parse(String(raw));
      } catch {
        this.log.warn('Relay received invalid JSON');
        return;
      }

      this.log.log(
        `RELAY frame: type=${frame.type}, ` +
        `fields=${Object.keys(frame).join(',')}`
      );

      void this.handle(
        ws,
        session,
        String(raw),
      ).catch(error => {
        this.log.error(
          `Relay processing failed: ${String(error)}`
        );
      });
    });

    ws.on('close', (code, reason) => {
      this.log.warn(
        `RELAY disconnected: code=${code}, ` +
        `reason=${reason.toString()}`
      );
    });

    ws.on('error', error => {
      this.log.error(
        `RELAY WebSocket error: ${error.message}`
      );
    });
  });
}

 private send(ws:WebSocket,value:object):void {if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(value));}
 private language(text:string,provided:unknown):Language|undefined {
  // Do not trust the default "en" from an English-first ASR as proof of English.
  const es=/[¿¡ñáéíóú]|\b(hola|buenas|soy|llamo|llamando|quisiera|necesito|hablar|entrevista|trabajo|colegio|escuela|usted|para|por favor|con|porque|estudiante)\b/i.test(text);
  const en=/\b(hello|hi|calling|interview|school|job|because|please|need|speak|looking|position|tomorrow|appointment)\b/i.test(text);
  if(es&&!en)return 'es'; if(en&&!es)return 'en';
  const lang=String(provided||'').toLowerCase();
  if(es&&en)return 'es';
  if(lang.startsWith('es'))return 'es';
  if(lang.startsWith('en')&&text.split(/\s+/).length>=3)return 'en';
  return undefined;
 }
 private async handle(ws:WebSocket,s:Session,raw:string):Promise<void>{
  let frame:any;try{frame=JSON.parse(raw);}catch{return;}
if (frame.type === 'setup') {
  this.log.log('RELAY setup recibido');

  this.log.log(
    `Call ID matches: ${
      frame.callControlId === s.id
    }`
  );

  // // Prueba de síntesis de voz directamente desde NestJS.
  // this.send(ws, {
  //   type: 'text',
  //   token: 'Hello?',
  //   last: true,
  // });
  return;
}
if (frame.type === 'prompt') {
  this.log.log(
    `RELAY prompt: lang=${String(frame.lang ?? 'unknown')}, ` +
    `last=${String(frame.last)}, ` +
    `characters=${String(frame.voicePrompt ?? '').length}`,
  );
}
  if(!s.id)return;

if (await this.calls.phase(s.id) === 'RELAY_DONE') {
  return;
}
  if(frame.type==='error'){this.log.warn(`Telnyx relay: ${String(frame.description||'error').slice(0,200)}`);return;}
  if(frame.type!=='prompt'||frame.last!==true)return;
  const text=String(frame.voicePrompt||'').trim().slice(0,1500);
  if(!text)return;
  s.pending.push(text);
  if(s.busy)return;
  s.busy=true;
  try {
   while(s.pending.length){
    const turn=s.pending.shift()!;
    s.turns.push(turn);
    const combined=s.turns.join(' ').slice(0,6000);
    const spokenLanguage =
  this.detectSpokenLanguage(combined);

const lang =
  spokenLanguage ||
  s.lang ||
  this.language(combined, frame.lang);
if (lang && !s.lang) {
  s.lang = lang;

  if (lang === 'es') {
    this.send(ws, {
      type: 'language',
      ttsLanguage: 'es-ES',
    });

    this.log.log('RELAY: TTS language switched to es-ES');
  }
}
    // First turn: don't wait for remote LLM classification just to ask a clarifying question.
    const substantive = /\b(entrevista|trabajo|colegio|escuela|hospital|cita|estudiante|reclutador|empleo|interview|job|school|hospital|appointment|recruiter|calling (about|from|to)|llamo (por|para|del|de)|necesito hablar)\b/i.test(combined)
      || combined.trim().split(/\s+/).length>=10;
    if(!substantive&&!s.asking){
     s.asking=true;
     const reply=s.lang==='es'?'Claro. ¿Con quién hablo y cuál es el motivo de su llamada?':'May I have your name and the reason for your call?';
     this.send(ws,{type:'text',token:reply,last:true});
     continue;
    }
    const ctx=await this.calls.callerContext(s.id);
    
const assessment = await this.classifier.assess(
  combined,
  Boolean(ctx?.contact_id),
);

const resolved: Language =
  s.lang || (assessment.language === 'es' ? 'es' : 'en');

if (!s.lang) {
  s.lang = resolved;

this.send(ws, {
  type: 'language',
  ttsLanguage: resolved === 'en' ? 'en-US' : 'es-ES',
});

this.log.log(
  `RELAY: detected=${resolved}, frame=${frame.lang}, text=${combined}`
);
}

await this.calls.recordRelayTranscript(
  s.id,
  combined,
  resolved,
  assessment,
);

await this.calls.setPhase(s.id, 'RELAY_DONE');

const goodbye =
  resolved === 'es'
    ? 'Gracias. Le haré llegar su mensaje.'
    : 'Thank you. I will pass along your message.';

this.send(ws, {
  type: 'text',
  token: goodbye,
  last: true,
});

this.log.log(
  `RELAY final response: language=${resolved}`,
);

const callId = s.id;

// Respaldo temporal: permite reproducir la despedida
// antes de finalizar la llamada.
setTimeout(() => {
  void (async () => {
    try {
      if (await this.calls.isEnded(callId)) return;

      await this.telnyx.hangup(callId);

      this.log.log('RELAY: call ended automatically');
    } catch (error) {
      if (error instanceof TelnyxCallEndedError) {
        return;
      }

      this.log.error(
        `RELAY hangup failed: ${String(error)}`,
      );
    }
  })();
}, 6000);

return;
    // End frame is not immediate: the TTS response must be audible first.
    // Caller can hang up; Telnyx handles that naturally. A max duration guard belongs upstream.
    return;
   }
  }finally{s.busy=false;}
 }

  private detectSpokenLanguage(text: string): 'es' | 'en' | null {
    const normalized = text.toLowerCase();

    const spanish = [
      /\b(hola|buenos días|buenas tardes|quisiera|gustaría)\b/i,
      /\b(llamar|llamada|mensaje|entrevista|trabajo)\b/i,
      /\b(por favor|gracias|necesito hablar|me puede)\b/i,
    ];

    const english = [
      /\b(hello|hi|good morning|good afternoon)\b/i,
      /\b(i am calling|i'm calling|i need|i would like)\b/i,
      /\b(can i speak|may i speak|please|message)\b/i,
      /\b(interview|job|recruiter|call me back)\b/i,
    ];

    const esScore = spanish.filter((r) => r.test(normalized)).length;
    const enScore = english.filter((r) => r.test(normalized)).length;

    if (enScore > esScore) return 'en';
    if (esScore > enScore) return 'es';

    return null;
  }
}
