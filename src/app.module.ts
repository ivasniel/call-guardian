import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelnyxController } from './telnyx/telnyx.controller';
import { TelnyxService } from './telnyx/telnyx.service';
import { ContactsService } from './contacts/contacts.service';
import { CallsService } from './calls/calls.service';
import { TranscriptionService } from './ai/transcription.service';
import { RecordingWorkerService } from './ai/recording-worker.service';
import { ClassificationService } from './ai/classification.service';
import { RelayService } from './telnyx/relay.service';
import { ScreeningService } from './screening/screening.service';
@Module({imports:[
 ConfigModule.forRoot({isGlobal:true}),
 TypeOrmModule.forRoot({type:'mysql',host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3307),username:process.env.DB_USER||'guardian',password:process.env.DB_PASSWORD||'guardian_dev_only',database:process.env.DB_NAME||'call_guardian',synchronize:false,entities:[]}),
],controllers:[TelnyxController],
providers:[TelnyxService,ContactsService,CallsService,ScreeningService,ClassificationService,TranscriptionService,RecordingWorkerService, RelayService]})
export class AppModule {}
