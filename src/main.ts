import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';
import { RelayService } from './telnyx/relay.service';

async function bootstrap() {
 const app = await NestFactory.create(AppModule, { bodyParser: false });
 // Retain the exact raw payload for signature verification.
 app.use(json({ verify: (req: any, _res, buf) => { req.rawBody = Buffer.from(buf); }, limit:'100kb' }));
 app.get(RelayService).attach(app.getHttpServer());
 await app.listen(Number(process.env.PORT || 3100), '0.0.0.0');
 console.log(`Call Guardian API listening on ${process.env.PORT || 3100}`);
}
bootstrap();
