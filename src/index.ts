import { chromium } from "playwright-core";
import awsChromium from "chrome-aws-lambda";
import { ExtractionRes, SQSEvent } from "./interfaces";
import { ListingSource } from "./enums";
import { vrboExtraction } from "./vrbo";
import { abnbExtraction } from "./abnb";
import { getExtractionRequest } from "./fn";
import AWSSvc from "./s3";
import * as aws from "@aws-sdk/client-sqs"

exports.handler = async (event: SQSEvent) => {
  //console.log("start")
  AWSSvc.init();
  const sqs = new aws.SQS({ apiVersion: '2012-11-05' });
  const extractionRequest = getExtractionRequest(event);

  let extraction: ExtractionRes;
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
    extraction = await vrboExtraction(browser, extractionRequest);
    await browser.close();
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
      proxy: {
        server: "http://x.botproxy.net:8080",
        username: "pxu29513-0",
        password: "bUQDwQFlDCnWGPqqVJF1",
      },
    });
    extraction = await abnbExtraction(browser,extractionRequest);
    await browser.close();
  }

  const params = {
		MessageBody: JSON.stringify(extraction),
		QueueUrl: "https://sqs.us-east-1.amazonaws.com/107072109140/backend",
	};
	const result = await sqs.sendMessage(params);
	console.log(result);

};