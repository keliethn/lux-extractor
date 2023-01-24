import { chromium, Page } from "playwright-chromium";
import { ExtractionReq, ExtractionRes, SQSEvent } from "./interfaces";
import { ElementToExtract, ListingSource } from "./enums";
import { vrboExtraction } from "./vrbo";
import { abnbExtraction } from "./abnb";
import { getExtractionRequest, objToBase64 } from "./fn";
// import { mq } from "./amqp";
import AWSSvc from "./s3";
import dotenv from "dotenv";
import * as path from "path";

const handler = async (event: SQSEvent) => {
  dotenv.config({
    path: path.join(__dirname, "./config.env"),
  });

  AWSSvc.init();
  const extractionRequest = getExtractionRequest(event);

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
    await browser.close();
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
    extraction = await abnbExtraction(browser, extractionRequest);
    await browser.close();
  }

  // await  sendToBackend(extraction);

  console.log(JSON.stringify(extraction))
  // console.log("Send to backend");
  return extraction;
  //process.exit(0)
  // sendToBackend(extraction).then((x) => {
  //   console.log("Send to backend: ", x);
  // });
};
// TEST

const data: ExtractionReq = {
  source: ListingSource.AirBnB,
  sourceId: "Hacienda-Iguana--Tola--Nicaragua",
  sourceCount: 0,
  sourceData: [],
  element: ElementToExtract.search,
  userId: "2222222222",
  extractionId: "1111111111",
  companyId: "0000000000",
};

const testObj: SQSEvent = {
  Records:[
    {
      messageId: 'ce7112da-9556-4eb8-9d36-128facd20606',
      receiptHandle: 'AQEBuqohnmyZmAvL3K7zcs3H28JWAygfCqUDB4YKLZGqvFOWDG2FcF0M67o3L3SPdoVIUkAuzpz7MMg0xk49O0QelNLqWCDWT8xIlIDGvGqzIJw5z5JxeW7j8QMMhXc5a0ZEQCwDWAIF8FgRTJxWg1/PY4eM12iZmp/7WRD3b5cG+iiDO3C0UQoLbKeVcNZPzBJLjfYx3YNBGQOSg4VDDrTsaRfT1fguDhoIXQ1fVo7dc0A3sT+O/1R1W9CzTcmk6WsbqKAwaJpZnlEHVIAR0bacBOE6lbf60lrRAK3cjtQmF/9PdmVWwCx1cbtqXjztK6cG2zovW9sE4vXq1SH8asUh6n/8530/febN4o67jqRZeuqAnwOeJ9sScWFo6FUnSXLm',
      body: JSON.stringify(data),
      attributes: [],
      messageAttributes: {},
      md5OfBody: 'ded61807bacc566530c2f86cb85cd47a',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:107072109140:extractor',
      awsRegion: 'us-east-1'
    }
  ]
};

handler(testObj);
