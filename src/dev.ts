import "reflect-metadata";
import { chromium } from "playwright-chromium";
import { ExtractionReq, ExtractionRes, SQSEvent } from "./interfaces";
import { ElementToExtract, ListingSource } from "./enums";
import { vrboExtraction } from "./vrbo";
import { abnbExtraction } from "./abnb2";
import { getExtractionRequest } from "./fn";
import AWSSvc from "./s3";
import dotenv from "dotenv";
import * as path from "path";
import * as aws from "@aws-sdk/client-sqs";

const handler = async (event: SQSEvent) => {
  dotenv.config({
    path: path.join(__dirname, "./config.env"),
  });

  AWSSvc.init();
  const sqs = new aws.SQS({ apiVersion: "2012-11-05" });
  const extractionRequest = getExtractionRequest(event);

  //let extraction: ExtractionRes;
  if (extractionRequest.source === ListingSource.VRBO) {
    const browser = await chromium.launch({
      headless: false,
      chromiumSandbox: false,
      // proxy: {
      //   server: "http://x.botproxy.net:8080",
      //   username: "pxu29513-0",
      //   password: "bUQDwQFlDCnWGPqqVJF1",
      // },
    });
    try {
     let vrboExtractionResult = await vrboExtraction(browser, extractionRequest);
     sendResponse(vrboExtractionResult)
    await browser.close();
    } catch (error) {
      let extractionException = {
        extractionId: extractionRequest.extractionId,
        source: extractionRequest.source,
        sourceId: extractionRequest.sourceId,
        userId: extractionRequest.userId,
        element: ElementToExtract.ERROR,
        companyId: extractionRequest.companyId,
        error:error
      };
      sendResponse(extractionException)
      //console.log(JSON.stringify(extractionException));
      await browser.close();
    }
    
  } else if (extractionRequest.source === ListingSource.AirBnB) {
    const browser = await chromium.launch({
      headless: false,
      chromiumSandbox: false,
      // proxy: {
      //   server: "http://x.botproxy.net:8080",
      //   username: "pxu29513-0",
      //   password: "bUQDwQFlDCnWGPqqVJF1",
      // },
    });
    try {
      let abnbExtractionResult = await abnbExtraction(browser, extractionRequest);
      sendResponse(abnbExtractionResult)
    await browser.close();
    } catch (error) {
      if(typeof error==="string"){
        if(String(error)==="not found"){
          let extractionNotFound = {
            extractionId: extractionRequest.extractionId,
            source: extractionRequest.source,
            sourceId: extractionRequest.sourceId,
            userId: extractionRequest.userId,
            element: ElementToExtract.NOT_FOUND,
            companyId: extractionRequest.companyId,
          };
          sendResponse(extractionNotFound)

        }
      }else{
        let extractionError = {
        extractionId: extractionRequest.extractionId,
        source: extractionRequest.source,
        sourceId: extractionRequest.sourceId,
        userId: extractionRequest.userId,
        element: ElementToExtract.ERROR,
        companyId: extractionRequest.companyId,
        error:error
      };
      sendResponse(extractionError)

      }

     
      
      await browser.close();
    }
   
  }

  // console.log(JSON.stringify(extraction))
  //  const params = {
  //   MessageBody: JSON.stringify(extraction),
  //   QueueUrl: "https://sqs.us-east-1.amazonaws.com/107072109140/backend",
  // };
 
    //console.log(JSON.stringify(extraction));
 

  // const result = await sqs.sendMessage(params);
  // console.log("result sent back to backend");
  //return extraction;
};

const sendResponse = (extraction: ExtractionRes) => {
  console.log("Sending response to backend");
  console.log(JSON.stringify(extraction));
  console.log("Response sent");
};

// const data: ExtractionReq = {
//   companyId: "f25f6df7-4e78-4a70-80aa-4d63aa745ce5",
//   userId: "c8f5f86f-f76a-4dac-9627-6423dfd2d74c",
//   element: ElementToExtract.PRICE_RANGE_LOOKUP,
//   source: ListingSource.AirBnB,
//   sourceId: "",
//   sourceCount: 0,
//   sourceData: [
//     {
//       key: "bbox",
//       value: JSON.stringify({maxLat:11.386082997,maxLng:-86.027359206,minLat:11.380003711,minLng:-86.037916381}),
//     }
//   ],
//   extractionId: "a54f291a-ab21-4a5d-a906-e3c29d3d742b",
// };

// const data: ExtractionReq = {
//   companyId: "f25f6df7-4e78-4a70-80aa-4d63aa745ce5",
//   userId: "c8f5f86f-f76a-4dac-9627-6423dfd2d74c",
//   element: ElementToExtract.SEARCH,
//   source: ListingSource.AirBnB,
//   sourceId: "",
//   sourceCount: 0,
//   sourceData: [
//     {
//       key: "bbox",
//       value: JSON.stringify({
//         maxLat: 11.271960782,
//         maxLng: -85.842099697,
//         minLat: 11.237401857,
//         minLng: -85.88733247,
//       }),
//     },
//     {
//       key: "prices",
//       value: JSON.stringify({ max: 1100, min: 550,count:24 }),
//     },
//   ],
//   extractionId: "a54f291a-ab21-4a5d-a906-e3c29d3d742b",
// };

// const data: ExtractionReq = {
//   companyId: "f25f6df7-4e78-4a70-80aa-4d63aa745ce5",
//   userId: "c8f5f86f-f76a-4dac-9627-6423dfd2d74c",
//   element: ElementToExtract.HOST,
//   source: ListingSource.AirBnB,
//   sourceId: "574169",
//   sourceCount: 0,
//   sourceData: [],
//   extractionId: "a54f291a-ab21-4a5d-a906-e3c29d3d742b",
// };

const data: ExtractionReq = {
  companyId: "f25f6df7-4e78-4a70-80aa-4d63aa745ce5",
  userId: "c8f5f86f-f76a-4dac-9627-6423dfd2d74c",
  element: ElementToExtract.LISTING,
  source: ListingSource.AirBnB,
  sourceId: "1910453",
  sourceCount: 0,
  sourceData: [],
  extractionId: "a54f291a-ab21-4a5d-a906-e3c29d3d742b",
};

// const data: ExtractionReq = {
//   companyId: "f25f6df7-4e78-4a70-80aa-4d63aa745ce5",
//   userId: "c8f5f86f-f76a-4dac-9627-6423dfd2d74c",
//   element: ElementToExtract.REVIEWS,
//   source: ListingSource.AirBnB,
//   sourceId: "14527436",
//   sourceCount: 0,
//   sourceData: [],
//   extractionId: "a54f291a-ab21-4a5d-a906-e3c29d3d742b",
// };

// const data: ExtractionReq = {
//   companyId: "f25f6df7-4e78-4a70-80aa-4d63aa745ce5",
//   userId: "c8f5f86f-f76a-4dac-9627-6423dfd2d74c",
//   element: ElementToExtract.CALENDAR,
//   source: ListingSource.AirBnB,
//   sourceId: "14527436",
//   sourceCount: 0,
//   sourceData: [],
//   extractionId: "a54f291a-ab21-4a5d-a906-e3c29d3d742b",
// };


// const data: ExtractionReq = {
//   companyId: "f25f6df7-4e78-4a70-80aa-4d63aa745ce5",
//   userId: "c8f5f86f-f76a-4dac-9627-6423dfd2d74c",
//   element: ElementToExtract.GALLERY,
//   source: ListingSource.AirBnB,
//   sourceId: "14527436",
//   sourceCount: 0,
//   sourceData: [],
//   extractionId: "a54f291a-ab21-4a5d-a906-e3c29d3d742b",
// };


const testObj: SQSEvent = {
  Records: [
    {
      messageId: "ce7112da-9556-4eb8-9d36-128facd20606",
      receiptHandle:
        "AQEBuqohnmyZmAvL3K7zcs3H28JWAygfCqUDB4YKLZGqvFOWDG2FcF0M67o3L3SPdoVIUkAuzpz7MMg0xk49O0QelNLqWCDWT8xIlIDGvGqzIJw5z5JxeW7j8QMMhXc5a0ZEQCwDWAIF8FgRTJxWg1/PY4eM12iZmp/7WRD3b5cG+iiDO3C0UQoLbKeVcNZPzBJLjfYx3YNBGQOSg4VDDrTsaRfT1fguDhoIXQ1fVo7dc0A3sT+O/1R1W9CzTcmk6WsbqKAwaJpZnlEHVIAR0bacBOE6lbf60lrRAK3cjtQmF/9PdmVWwCx1cbtqXjztK6cG2zovW9sE4vXq1SH8asUh6n/8530/febN4o67jqRZeuqAnwOeJ9sScWFo6FUnSXLm",
      body: JSON.stringify(data),
      attributes: [],
      messageAttributes: {},
      md5OfBody: "ded61807bacc566530c2f86cb85cd47a",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:us-east-1:107072109140:extractor",
      awsRegion: "us-east-1",
    },
  ],
};

handler(testObj);
