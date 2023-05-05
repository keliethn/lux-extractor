import "reflect-metadata";
import { chromium } from "playwright-chromium";
import { ExtractionReq, ExtractionRes, SQSEvent } from "./interfaces";
import { ElementToExtract, ListingSource } from "./enums";
import { vrboExtraction } from "./vrbo";
import { abnbExtraction } from "./abnb";
import { getExtractionRequest } from "./fn";
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

  console.log(JSON.stringify(extraction))
  return extraction;

};

const data: ExtractionReq = {
  source: ListingSource.AirBnB,
  sourceId: "53987066",
  element: ElementToExtract.lookup,
  sourceCount: 0,
  sourceData: [],
  userId: 'c8f5f86f-f76a-4dac-9627-6423dfd2d74c',
  extractionId: 'a72edb04-fb75-4608-b6a4-5f45dfedf099',
  companyId: 'f25f6df7-4e78-4a70-80aa-4d63aa745ce5'
  // source: ListingSource.VRBO,
  // sourceId: "guacalito-de-la-isla-tola-rivas-department-nicaragua", // vrbo details -> 4442382ha ||  vrbo others -> 127.4442382.5027381
  // sourceCount: 0,
  // sourceData: [],
  // element: ElementToExtract.search,
  // userId: "2222222222",
  // extractionId: "1111111111",
  // companyId: "0000000000",
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
