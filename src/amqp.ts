import * as amqp from "amqplib";
import { v4 as uuidv4 } from "uuid";
import { ExtractionRes } from "./interfaces";


export const sendToBackend=async(message: ExtractionRes)=>{
  return new Promise((resolve,reject)=>{
    amqp.connect({
      protocol: process.env.amqpprotocol,
      hostname: process.env.amqphostname,
      port: parseInt(process.env.amqpport),
      username: process.env.amqpusername,
      password: process.env.amqppassword,
    }).then((conn)=>{
      conn.createChannel().then(channel=>{
        channel.assertQueue(process.env.amqpqueue).then(()=>{
          channel.assertExchange(
            process.env.amqpexchangename,
            process.env.amqpexchangetype
          ).then(()=>{
            channel.bindQueue(
              process.env.amqpqueue,
              process.env.amqpexchangename,
              process.env.amqppattern
            ).then(()=>{
              let id = {
                amqpid: uuidv4().toString(),
              };
              Object.assign(message, id);
          
              const sent = channel.publish(
                process.env.amqpexchangename,
                `backend.req:extr-${message.source}`,
                Buffer.from(JSON.stringify(message)),
                {
                  persistent: true,
                }
              );
  
              resolve(sent)
            })
          })
        })
      })
      
    }).catch((reason:any)=>{
      reject(reason)
      
    })
  })
 
}


export default class Broker {
  mq: amqp.Connection | undefined = undefined;
  constructor() {
    this.createMQConnection().then((_) => {
      this.createQueue().then(() => {
        console.log(
          ` AMQP > QUEUE ${process.env.amqpqueue} TOPIC ${process.env.amqppattern}`
        );
      });
    });
  }

  // private async init(){
  //   this.createMQConnection().then((_) => {
  //     Broker.createQueue().then(()=>{
  //       console.log(` AMQP > QUEUE ${process.env.amqpqueue} TOPIC ${process.env.amqppattern}`,)
  //     })

  //   });
  // }

  private async createQueue() {
    const channel = await this.mq.createChannel();
    await channel.assertQueue(process.env.amqpqueue);
    await channel.assertExchange(
      process.env.amqpexchangename,
      process.env.amqpexchangetype
    );
    await channel.bindQueue(
      process.env.amqpqueue,
      process.env.amqpexchangename,
      process.env.amqppattern
    );
  }

  closeConnection=()=>{
    this.mq.close()
  }

  sendToMQ = async (message: ExtractionRes) => {
    const channel = await this.mq.createChannel();
    await channel.assertExchange(
      process.env.amqpexchangename,
      process.env.amqpexchangetype
    );
    let id = {
      amqpid: uuidv4().toString(),
    };
    Object.assign(message, id);

    const sent = channel.publish(
      process.env.amqpexchangename,
      `backend.req:extr-${message.source}`,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
      }
    );

    return sent;
  };

  private createMQConnection = async () => {
    try {
      this.mq = await amqp.connect({
        protocol: process.env.amqpprotocol,
        hostname: process.env.amqphostname,
        port: parseInt(process.env.amqpport),
        username: process.env.amqpusername,
        password: process.env.amqppassword,
      });
    } catch (err: any) {
      console.warn("AMQP Error(s): ", err);
    }
  };
}

// export const createMQConnection = async () => {
//   try {
//     Broker.mq = await amqp.connect({
//       protocol:process.env.amqpprotocol,
//       hostname:process.env.amqphostname,
//       port:parseInt(process.env.amqpport),
//       username:process.env.amqpusername,
//       password:process.env.amqppassword
//     });
//   } catch (err: any) {
//     console.warn("AMQP Error(s): ",err)

//   }
// };

// export const sendToMQ = async (message: object, route: string) => {
//   const channel = await Broker.mq.createChannel();
//   await channel.assertExchange(
//     process.env.amqpexchangename,
//     process.env.amqpexchangetype
//   );
//   let id = {
//     amqpid: uuidv4().toString(),
//   };
//   Object.assign(message, id);

//   const sent = channel.publish(
//     process.env.amqpexchangename,
//     route,
//     Buffer.from(JSON.stringify(message)),
//     {
//       persistent: true,
//     }
//   );

//   return sent;
// };

// export const MQConnect = async () => {

//   createMQConnection().then((_) => {
//     // receiveFromMQ().then(() => {
//       console.log(` AMQP > QUEUE ${process.env.amqpqueue} TOPIC ${process.env.amqppattern}`,)

//     // });
//   });
// };
