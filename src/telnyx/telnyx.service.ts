import { Injectable } from '@nestjs/common';
import { randomUUID, createHmac } from 'node:crypto';
import type { AccountSettings } from '../account/account-settings.service';

export class TelnyxCallEndedError extends Error {
  constructor() { super('Call already ended'); }
}
@Injectable()
export class TelnyxService {
    
  private async command(id: string, action: string, body: Record<string, unknown> = {}): Promise<void> {
    const key = process.env.TELNYX_API_KEY;
    if (!key) throw new Error('TELNYX_API_KEY missing');
    const response = await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(id)}/actions/${action}`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, command_id: randomUUID() }), signal: AbortSignal.timeout(10000),
    });
    if (response.ok) return;
    const text = await response.text();
    let code = '';
    try { code = String(JSON.parse(text)?.errors?.[0]?.code ?? ''); } catch { /* not JSON */ }
    if (response.status === 422 && code === '90018') throw new TelnyxCallEndedError();
    throw new Error(`Telnyx ${action}: ${response.status} ${text.slice(0,500)}`);
  }
  answer(id:string) { return this.command(id,'answer'); }
  hangup(id:string) { return this.command(id,'hangup'); }
  speak(id:string,text:string, language: 'en'|'es'='en') {
    return this.command(id,'speak',{payload:text,voice:'female',language:language==='es'?'es-MX':'en-US'});
  }
  gather(id:string,text:string) {
    return this.command(id,'gather_using_speak',{payload:text,voice:'female',language:'en-US',minimum_digits:1,maximum_digits:1,valid_digits:'12',timeout_millis:12000});
  }


startRelay(id: string, settings: AccountSettings) {
  const host = process.env.PUBLIC_BASE_URL;
  const secret = process.env.RELAY_SHARED_SECRET;

  if (!host?.startsWith('https://')) {
    throw new Error('PUBLIC_BASE_URL must use HTTPS');
  }

  if (!secret || secret.length < 24) {
    throw new Error('RELAY_SHARED_SECRET missing');
  }

  const relayUrl = new URL('/relay', host);
  relayUrl.protocol = 'wss:';

  const expires = String(
    Math.floor(Date.now() / 1000) + 300,
  );

  const signature = createHmac('sha256', secret)
    .update(`${id}:${expires}`)
    .digest('hex');

  relayUrl.searchParams.set('call', id);
  relayUrl.searchParams.set('expires', expires);
  relayUrl.searchParams.set('signature', signature);

  // El idioma automático conserva el comportamiento
  // inicial que ya funciona en el piloto.
  const language =
    settings.language === 'en' ? 'en' : 'es';

  const greeting =
    language === 'en'
      ? settings.greetingEn
      : settings.greetingEs;

  return this.command(id, 'conversation_relay_start', {
    url: relayUrl.toString(),
    greeting,
    language,
    voice: 'Soniox.tts-rt-v2.Emma',
    transcription_engine: 'Soniox',
    transcription_engine_config: {
      transcription_model: 'soniox/stt-rt-v4',
      language: 'auto',
    },
  });
}


  startRecording(id:string) {
    return this.command(id,'record_start',{
      format:'wav',channels:'single',recording_track:'inbound',play_beep:true,
      max_length:Number(process.env.RECORDING_MAX_SECONDS || 25),
      timeout_secs:Number(process.env.RECORDING_SILENCE_SECONDS || 3),
      // Do NOT enable Telnyx transcription: OpenAI handles it independently.
      transcription:false,
    });
  }
  endRelay(id: string) {
    return this.command(id, 'conversation_relay_stop');
    }
}
