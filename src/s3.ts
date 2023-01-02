// import aws from "aws-sdk";
import * as aws from "@aws-sdk/client-s3"
export default class AWSSvc {
  private static _s3: aws.S3;
  private static initialized: boolean;
  private constructor() {}

  static init() {
    if (!AWSSvc.initialized || !AWSSvc.initialized === false) {
      // aws.config.update();
      AWSSvc._s3 = new aws.S3({
        credentials:{
          secretAccessKey: process.env.s3secret,
        accessKeyId: process.env.s3key
        },        
        region: "us-east-1",
      });
      AWSSvc.initialized = true;
    }
  }

  static get s3() {
    return AWSSvc._s3;
  }
}
