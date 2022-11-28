// exports.handler = async (event:object) => {
//     console.log(Object.keys(event))
//     return `Done ${event}`
// }

import { chromium, Page } from "playwright-core";
import awsChromium from "chrome-aws-lambda";
import { DataSource, Listing } from "./interfaces";


//import { chromium, Page } from "playwright-chromium";

let listing: Listing = {
  unitId: "",
  sessionId: "",
  provider: DataSource.VRBO,
  providerId: "",
  requestId: "",
  instance: "",
  details: {
    provider: DataSource.VRBO,
    providerId: "",
    unitName: "",
    maxOccupancy: 0,
    bedrooms: 0,
    beds: 0,
    baths: 0,
    costPerNight: 0,
    description: "",
  },
  gallery: {
    count: 0,
    provider: DataSource.VRBO,
    providerId: "",
    userId: "",
    images: [],
  },
  reviews: {
    count: 0,
    provider: DataSource.VRBO,
    providerId: "",
    items: [],
  },
  ambients: {
    count: 0,
    provider: DataSource.VRBO,
    providerId: "",
    items: [],
  },
};


exports.handler = async () => {
  console.log("start");
  const browser = await chromium.launch({
    args: ["--disable-dev-shm-usage", "--disable-gpu", "--single-process", "--no-zygote", "--no-sandbox"],
    headless: true,
    executablePath: await awsChromium.executablePath,
    proxy:{
      server: "http://x.botproxy.net:8080",
      username: "pxu29513-0",
      password: "bUQDwQFlDCnWGPqqVJF1",
    }
  });

  // const browser = await chromium.launch({
  //     headless: false,
  //     chromiumSandbox: false,
  //     //   proxy: {
  //     //     server: "http://x.botproxy.net:8080",
  //     //     username: "pxu29513-0",
  //     //     password: "bUQDwQFlDCnWGPqqVJF1",
  //     //   },
  //   });

  const page = await browser.newPage();

  page.route("**", (route) => {
    let url = route.request().url();
    let method = route.request().method().toLowerCase();
    let modifiedBody = "";
    if (
      url.indexOf("https://www.vrbo.com/pdp/graphql") > -1 &&
      method === "post"
    ) {
      let pData = route.request().postData();
      let obj = pData && JSON.parse(pData);
      if (obj.operationName === "Reviews") {
        obj.variables.pageSize = listing.reviews.count;
        modifiedBody = JSON.stringify(obj);
      }
    } else if (
      url.indexOf("https://www.vrbo.com/mobileapi/graphql") > -1 &&
      method === "post"
    ) {
      let pData = route.request().postData();
      let obj = pData && JSON.parse(pData);
      if (obj.operationName === "Reviews") {
        obj.variables.pageSize = listing.reviews.count;
        modifiedBody = JSON.stringify(obj);
      }
    }
    return modifiedBody === ""
      ? route.continue()
      : route.continue({ postData: modifiedBody });
  });

  page.on("response", (response) => {
    let url = response.url();
    if (url.trim() === "https://www.vrbo.com/pdp/graphql") {
      response.body().then(async (b) => {
        let obj = JSON.parse(b.toString());

        if (obj.data.reviews) {
          obj.data.reviews.forEach((review) => {
            if (
              listing.reviews.items.find((x) => x.reviewId === review.uuid) ===
              undefined
            ) {
              let rev = {
                provider: DataSource.VRBO,
                providerId: "",
                reviewId: review.uuid,
                title: review.headline,
                rating: review.rating,
                date: review.datePublished,
                author: review.reviewer.nickname,
                comment: review.body,
                response: review.response === null ? "" : review.response.body,
              };
              listing.reviews.items.push(rev);
            }
          });
          if (listing.reviews.count !== listing.reviews.items.length) {
            page.waitForSelector(".pagination__next");

            let btn = await page.$(".pagination__next");
            if (btn !== null) {
              await btn.click();
            }
          } else {
            let response = listing;
            resetListing();
            await browser.close();
            console.log(response);
            console.log(JSON.stringify(response));
            //resolve(response);
          }
        }
      });
    } else if (url.trim() === "https://www.vrbo.com/mobileapi/graphql") {
      response.body().then(async (b) => {
        let obj = JSON.parse(b.toString());

        if (obj.data !== null) {
          if (obj.data.reviews) {
            obj.data.reviews.forEach((review) => {
              if (
                listing.reviews.items.find(
                  (x) => x.reviewId === review.uuid
                ) === undefined
              ) {
                let rev = {
                  provider: DataSource.VRBO,
                  providerId: "",
                  reviewId: review.uuid,
                  title: review.headline,
                  rating: review.rating,
                  date: review.datePublished,
                  author: review.reviewer.nickname,
                  comment: review.body,
                  response:
                    review.response === null ? "" : review.response.body,
                };
                listing.reviews.items.push(rev);
              }
            });
            if (listing.reviews.count !== listing.reviews.items.length) {
              page.waitForSelector(".pagination__next");
              let btn = await page.$(".pagination__next");
              if(btn!==null){
                await btn.click();
              }
              
            } else {
              let response = listing;
              resetListing();
              await browser.close();
              console.log(response);
              console.log(JSON.stringify(response));
              //resolve(response);
            }
          }
        }
      });
    }
  });

  await page.goto("https://www.vrbo.com/905538", {
    timeout: 60000,
  });

  await page.waitForLoadState("networkidle");

  let objString = await getElementText(page);
  let obj =objString && JSON.parse(objString);
  listing.unitId = "";
  listing.sessionId = "";
  listing.providerId = "";
  listing.provider = "";
  listing.requestId = "";
  listing.instance = "";

  listing.gallery.count = obj.listingReducer.images.length;
  listing.reviews.count = obj.reviewsReducer.reviewCount;
  listing.gallery.providerId = "";
  listing.gallery.userId = "";
  listing.reviews.providerId = "";

  obj.listingReducer.images.forEach((image) => {
    let imgString = image.uri.replace("https://", "");
    if (imgString !== null) {
      let imgArray = imgString.split("/");
      let imgArrayItem = imgArray[imgArray.length - 1];
      if (imgArrayItem !== null) {
        let imgId = imgArrayItem.split(".")[0];
        let url = image.uri.replace(imgArrayItem, imgId + ".jpg");
        let localId = "";
        localId = `vr80-`;
        let img = {
          provider:DataSource.VRBO,
          providerId: "",
          ambient: "",
          imageId: imgId,
          url: url,
          localId: localId,
          cloudUrl: `https://n365-media.s3.amazonaws.com/${localId}.webp`,
          caption: image.caption === null ? "" : image.caption,
        };

        listing.gallery.images.push(img);
      }
    }
  });

//   if (listing.gallery.images.length > 0) {
//     let imagesToRetrieve: ListingGalleryExtractionDto[] = [];
//     listing.gallery.images.forEach((x) => {
//       if (
//         storedImages.find((stored) => stored.imageId === x.imageId) ===
//         undefined
//       ) {
//         imagesToRetrieve.push(x);
//       }
//     });
//     if (imagesToRetrieve.length > 0) {
//       let galleryExt: GalleryExtraction = {
//         unitId: rq.unitId,
//         sessionId: rq.sessionId,
//         providerId: rq.providerId,
//         provider: Provider.VRBO,
//         requestId: rq.requestId,
//         userId: rq.userId,
//         instance: Server.serverInstance,
//         imagesCount: listing.gallery.count,
//         images: imagesToRetrieve,
//       };
//       await MQServer.sendToMQ(galleryExt, `backend.res.extr-gallery`);
//     }
//   }

  listing.details.unitName = obj.listingReducer.propertyName;
  listing.details.providerId = "";
  listing.details.bedrooms =
    obj.listingReducer.spaces.spacesSummary.bedroomCount;
  listing.details.beds =
    obj.listingReducer.spaces.spacesSummary.bedCountDisplay === null
      ? 0
      : obj.listingReducer.spaces.spacesSummary.bedCountDisplay.split(" ")[0];
  listing.details.baths =
    obj.listingReducer.spaces.spacesSummary.toiletOnlyCount !== null
      ? obj.listingReducer.spaces.spacesSummary.bathroomCount + ".5"
      : obj.listingReducer.spaces.bathroomCount;
  listing.details.costPerNight = obj.listingReducer.priceSummary.amount;
  listing.details.maxOccupancy = obj.listingReducer.sleeps;
  listing.details.description = obj.listingReducer.description;

  obj.reviewsReducer.reviews.forEach((review) => {
    let rev = {
      provider:DataSource.VRBO,
      providerId: "",
      reviewId: review.uuid,
      title: review.headline,
      rating: review.rating,
      date: review.datePublished,
      author: review.reviewer.nickname,
      comment: review.body,
      response: review.response === null ? "" : review.response.body,
    };
    listing.reviews.items.push(rev);
  });

  let navBtns = await page.$$(".Navigation__a");

  for (const btn of navBtns) {
    let href = await btn.getAttribute("href");
    if (href === "#reviews") {
      //console.log("Got reviews btn")
      await btn.click();
    }
  }

  return "done";
};

const resetListing = () => {
  listing = {
    unitId: "",
    sessionId: "",
    provider:DataSource.VRBO,
    providerId: "",
    requestId: "",
    instance: "",
    details: {
      provider:DataSource.VRBO,
      providerId: "",
      unitName: "",
      maxOccupancy: 0,
      bedrooms: 0,
      beds: 0,
      baths: 0,
      costPerNight: 0,
      description: "",
    },
    gallery: {
      count: 0,
      provider:DataSource.VRBO,
      providerId: "",
      userId: "",
      images: [],
    },
    reviews: {
      count: 0,
      provider:DataSource.VRBO,
      providerId: "",
      items: [],
    },
    ambients: {
      count: 0,
      provider:DataSource.VRBO,
      providerId: "",
      items: [],
    },
  };
};

const getElementText = async (page: Page): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    let elements = await page.$$("script:not([type]):not([src]):not([async])");
    for (const element of elements) {
      let textContent = await element.textContent();
      let elementText = textContent.trim();

      let stringMatch = elementText
        .substring(0, 51)
        .match(/window.__INITIAL_STATE__/gm);
      if (stringMatch !== null) {
        let obj = elementText.slice(27, elementText.length - 118).trim();
        resolve(obj);
      }
    }
  });
};
