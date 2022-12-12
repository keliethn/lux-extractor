import { chromium } from "playwright-core";
import awsChromium from "chrome-aws-lambda";
import { ExtractionRes, RabbitMqEvent } from "./interfaces";
import { ListingSource } from "./enums";
import { vrboExtraction } from "./vrbo";
import { abnbExtraction } from "./abnb";
import { getExtractionRequest } from "./fn";
import AWSSvc from "./s3";
import { sendToBackend } from "./amqp";

exports.handler = async (event: RabbitMqEvent) => {
  console.log("start")
  AWSSvc.init();
  const extractionRequest = getExtractionRequest(
    event.rmqMessagesByQueue["extractor::/"][0].data
  );

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
  }

  sendToBackend(extraction).then((x) => {
    console.log("Send to backend: ", x);
  });

  return extraction
};