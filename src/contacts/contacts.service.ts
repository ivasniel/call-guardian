import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class ContactsService {
 constructor(private readonly db:DataSource){}
 async resolveDestination(dialed:string){
  const rows:any[]=await this.db.query('SELECT user_id FROM phone_numbers WHERE telnyx_e164=? AND active=1 LIMIT 1',[dialed]);
  return rows[0]?.user_id ? Number(rows[0].user_id):null;
 }
 async find(userId:number,from:string){
  const rows:any[]=await this.db.query('SELECT id,display_name,classification,priority FROM contacts WHERE user_id=? AND phone_e164=? LIMIT 1',[userId,from]);
  return rows[0]??null;
 }
}
