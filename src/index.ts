import "reflect-metadata";
import AWSSvc from "./s3";
import * as aws from "@aws-sdk/client-sqs";
import { chromium } from "playwright-core";
import awsChromium from "chrome-aws-lambda";
import { ElementToExtract, ListingSource } from "./enums";
import { vrboExtraction } from "./vrbo";
import { abnbExtraction } from "./abnb2";
import { getExtractionRequest } from "./fn";
import { ExtractionRes, SQSEvent } from "./interfaces";

exports.handler = async (event: SQSEvent) => {
  AWSSvc.init();
  const sqs = new aws.SQS({ apiVersion: "2012-11-05" });
  const extractionRequest = getExtractionRequest(event);

  console.log(JSON.stringify(extractionRequest));

  //let extraction: ExtractionRes;
  if (extractionRequest.source === ListingSource.VRBO) {
    const browser = await chromium.launch({
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote",
        "--no-sandbox",
      ],
      headless: true,
      executablePath: await awsChromium.executablePath,
      proxy: {
        server: "http://x.botproxy.net:8080",
        username: "pxu29513-0",
        password: "bUQDwQFlDCnWGPqqVJF1",
      },
    });
    try {
      let vrboExtractionResult = await vrboExtraction(
        browser,
        extractionRequest
      );
      await sendResponse(vrboExtractionResult, sqs);
      await browser.close();
    } catch (error) {
      let vrboExtractionError = {
        extractionId: extractionRequest.extractionId,
        source: extractionRequest.source,
        sourceId: extractionRequest.sourceId,
        userId: extractionRequest.userId,
        element: ElementToExtract.ERROR,
        companyId: extractionRequest.companyId,
        error: error,
      };
      await sendResponse(vrboExtractionError, sqs);
      await browser.close();
    }
  } else if (extractionRequest.source === ListingSource.AirBnB) {
    const browser = await chromium.launch({
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote",
        "--no-sandbox",
      ],
      headless: true,
      executablePath: await awsChromium.executablePath,
      // proxy: {
      //   server: "http://x.botproxy.net:8080",
      //   username: "pxu29513-0",
      //   password: "bUQDwQFlDCnWGPqqVJF1",
      // },
    });
    try {
      let abnbExtractionResult = await abnbExtraction(
        browser,
        extractionRequest
      );
      await sendResponse(abnbExtractionResult, sqs);
      await browser.close();
    } catch (error) {
      if (typeof error === "string") {
        if (error === "not found") {
          let abnbNotFound = {
            extractionId: extractionRequest.extractionId,
            source: extractionRequest.source,
            sourceId: extractionRequest.sourceId,
            userId: extractionRequest.userId,
            element: ElementToExtract.NOT_FOUND,
            companyId: extractionRequest.companyId,
          };
          await sendResponse(abnbNotFound, sqs);
        }
      } else {
        let abnbError = {
          extractionId: extractionRequest.extractionId,
          source: extractionRequest.source,
          sourceId: extractionRequest.sourceId,
          userId: extractionRequest.userId,
          element: ElementToExtract.ERROR,
          companyId: extractionRequest.companyId,
          error: error,
        };
        await sendResponse(abnbError, sqs);
      }

      await browser.close();
    }
  }
};

const sendResponse = async (extraction: ExtractionRes, sqs: aws.SQS) => {
  console.log("Sending response to backend");
  console.log(JSON.stringify(extraction));
  const params = {
    MessageBody: JSON.stringify(extraction),
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/107072109140/backend",
  };
  const result = await sqs.sendMessage(params);
  console.log("Response sent");
};
