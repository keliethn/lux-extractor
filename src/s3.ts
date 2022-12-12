import aws from "aws-sdk";
export default class AWSSvc {
  private static _s3: aws.S3;
  private static initialized: boolean;
  private constructor() {}

  static init() {
    if (!AWSSvc.initialized || !AWSSvc.initialized === false) {
      aws.config.update({
        secretAccessKey: process.env.s3secret,
        accessKeyId: process.env.s3key,
        region: "us-east-1",
      });
      AWSSvc._s3 = new aws.S3();
      AWSSvc.initialized = true;
    }
  }

  static get s3() {
    return AWSSvc._s3;
  }
}
