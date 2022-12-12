import { chromium, Page } from "playwright-chromium";
import { ExtractionReq, ExtractionRes, RabbitMqEvent } from "./interfaces";
import { ElementToExtract, ListingSource } from "./enums";
import { vrboExtraction } from "./vrbo";
import { abnbExtraction } from "./abnb";
import { getExtractionRequest, objToBase64 } from "./fn";
// import { mq } from "./amqp";
import AWSSvc from "./s3";
import dotenv from "dotenv";
import * as path from "path";
import Broker, { sendToBackend } from "./amqp";

const handler = async (event: RabbitMqEvent) => {
  dotenv.config({
    path: path.join(__dirname, "./config.env"),
  });

  AWSSvc.init();
  const extractionRequest = getExtractionRequest(
    event.rmqMessagesByQueue["extractor::/"][0].data
  );

  let extraction: ExtractionRes;
  if (extractionRequest.source === ListingSource.VRBO) {
    const browser = await chromium.launch({
      //headless: false,
      chromiumSandbox: false,
      // proxy: {
      //   server: "http://x.botproxy.net:8080",
      //   username: "pxu29513-0",
      //   password: "bUQDwQFlDCnWGPqqVJF1",
      // },
    });
    extraction = await vrboExtraction(browser, extractionRequest);
  } else if (extractionRequest.source === ListingSource.AirBnB) {
    const browser = await chromium.launch({
      //headless: false,
      chromiumSandbox: false,
      // proxy: {
      //   server: "http://x.botproxy.net:8080",
      //   username: "pxu29513-0",
      //   password: "bUQDwQFlDCnWGPqqVJF1",
      // },
    });
    extraction = await abnbExtraction(browser,extractionRequest);
  }


  sendToBackend(extraction).then((x) => {
    console.log("Send to backend: ", x);
  });
};
// TEST

const data: ExtractionReq = {
  source: ListingSource.AirBnB,
  sourceId: "15410003",
  sourceCount: 0,
  sourceData: [],
  element: ElementToExtract.details,
  userId: "2222222222",
  extractionId: "1111111111",
  companyId: "0000000000",
};

const testObj: RabbitMqEvent = {
  eventSourceArn:
    "arn:aws:mq:us-east-1:107072109140:broker:lux-bcknd-extractor:b-bb2de43d-024b-413e-b11c-5a9b3312144f",
  rmqMessagesByQueue: {
    "extractor::/": [
      {
        basicProperties: {
          contentType: null,
          contentEncoding: null,
          headers: {},
          deliveryMode: 2,
          priority: null,
          correlationId: null,
          replyTo: null,
          expiration: null,
          messageId: null,
          timestamp: null,
          type: null,
          userId: null,
          appId: null,
          clusterId: null,
          bodySize: 149,
        },
        redelivered: false,
        data: objToBase64(data),
      },
    ],
  },
  eventSource: "aws:rmq",
};

handler(testObj);
