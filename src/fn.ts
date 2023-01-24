import axios from "axios";
import { AbnbSearchRequest, ExtractionReq, SearchResponse, SQSEvent } from "./interfaces";
import {
  AbnbAvalibility,
  AbnbListing,
  AbnbListingList,
  AbnbReviews,
  AbnbUser,
  ListingGalleryExtraction,
  ListingSearchExtraction,
} from "./types";
import urlencode from "urlencode";
import sharp from "sharp";
import AWSSvc from "./s3";
import { APIRequestContext } from "playwright-chromium";
import { PutObjectCommand, PutObjectCommandInput } from "@aws-sdk/client-s3";

// const axiosExtractorInstance = axios.create({
//   responseType: "json",
//   headers: {
//     "X-Airbnb-API-Key": "d306zoyjsyarp7ifhu67rjxn52tv0t20",
//     "cache-control": "no-cache",
//     "user-agent": "Airbnb/17.50 iPad/11.2.1 Type/Tablet",
//     "content-type": "application/json",
//     accept: "application/json",
//     "accept-encoding": "br, gzip, deflate",
//     "accept-language": "en-us",
//     "x-airbnb-locale": "en",
//     "x-airbnb-currency": "USD",
//   },
//   proxy: {
//     protocol: "http",
//     host: "x.botproxy.net",
//     port: 8080,
//     auth: {
//       username: "pxu29513-0",
//       password: "bUQDwQFlDCnWGPqqVJF1",
//     },
//   },
// });

export const getExtractionRequest = (event: SQSEvent) => {
  let response: ExtractionReq;
  let body=event.Records[0].body;
  response = JSON.parse(body) as ExtractionReq;
  return response;
};

export const getListing = async (api: APIRequestContext, listingId: number) => {
  let resp = await api.get(
    `https://www.airbnb.com/api/v1/listings/${listingId}`,
    {
      headers: {
        "x-airbnb-api-key": "d306zoyjsyarp7ifhu67rjxn52tv0t20",
      },
    }
  );

  let rawBody = await resp.body();
  let jsonBody = JSON.parse(rawBody.toString());

  let listing = jsonBody as AbnbListing;

  //console.log(listing);
  return listing;
};

export const getListings = async (
  api: APIRequestContext,
  userId: number,
  listingCount: number
) => {
  // let listing = await axiosExtractorInstance.get<AbnbListingList>(
  //   `https://www.airbnb.com/api/v2/user_promo_listings?locale=en-US&currency=USD&_limit=${listingCount}&_offset=0&user_id=${userId}`
  // );
  let resp = await api.get(
    `https://www.airbnb.com/api/v2/user_promo_listings?locale=en-US&currency=USD&_limit=${listingCount}&_offset=0&user_id=${userId}`,
    {
      headers: {
        "x-airbnb-api-key": "d306zoyjsyarp7ifhu67rjxn52tv0t20",
      },
    }
  );

  let rawBody = await resp.body();
  let jsonBody = JSON.parse(rawBody.toString());

  let listing = jsonBody as AbnbListingList;
  // console.log(listing.data);
  return listing;
};

export const getReviews = async (
  api: APIRequestContext,
  listingId: number,
  limit: number
) => {
  let rawVars = `{"request":{"fieldSelector":"for_p3","limit":${limit},"listingId":"${listingId}","numberOfAdults":"1","numberOfChildren":"0","numberOfInfants":"0"}}`;
  let rawExt = `{"persistedQuery":{"version":1,"sha256Hash":"6a71d7bc44d1f4f16cced238325ced8a93e08ea901270a3f242fd29ff02e8a3a"}}`;
  let variables = urlencode(rawVars);
  let extentions = urlencode(rawExt);
  // let reviews = await axiosExtractorInstance.get<AbnbReviews>(
  //   `https://www.airbnb.com/api/v3/PdpReviews?operationName=PdpReviews&locale=en&currency=USD&variables=${variables}&extensions=${extentions}`
  // );

  let resp = await api.get(
    `https://www.airbnb.com/api/v3/PdpReviews?operationName=PdpReviews&locale=en&currency=USD&variables=${variables}&extensions=${extentions}`,
    {
      headers: {
        "x-airbnb-api-key": "d306zoyjsyarp7ifhu67rjxn52tv0t20",
      },
    }
  );

  let rawBody = await resp.body();
  let jsonBody = JSON.parse(rawBody.toString());

  let reviews = jsonBody as AbnbReviews;

  // console.log(reviews.data);
  return reviews;
};

export const getAvailalibity = async (
  api: APIRequestContext,
  listingId: number,
  dateStart: string,
  dateEnd: string
) => {
  // let calendar = await axiosExtractorInstance.get<AbnbAvalibility>(
  //   `https://api.airbnb.com/v2/calendars/${listingId}/${dateStart}/${dateEnd}`
  // );
  let resp = await api.get(
    `https://airbnb.com/api/v2/calendars/${listingId}/${dateStart}/${dateEnd}`,
    {
      headers: {
        "x-airbnb-api-key": "d306zoyjsyarp7ifhu67rjxn52tv0t20",
      },
    }
  );

  let rawBody = await resp.body();
  let jsonBody = JSON.parse(rawBody.toString());

  let calendar = jsonBody as AbnbAvalibility;
  // // console.log(calendar.data);
  return calendar;
};

export const getUser = async (api: APIRequestContext, userId: number) => {
  // let user = await axiosExtractorInstance.get<AbnbUser>(
  //   `https://api.airbnb.com/v2/users/${userId}`
  // );
  let resp = await api.get(`https://airbnb.com/api/v2/users/${userId}`, {
    headers: {
      "x-airbnb-api-key": "d306zoyjsyarp7ifhu67rjxn52tv0t20",
    },
  });

  let rawBody = await resp.body();
  let jsonBody = JSON.parse(rawBody.toString());

  let user = jsonBody as AbnbUser;
  // // console.log(user.data);
  return user;
};

export const saveRemoteImagesToS3 = async (
  api: APIRequestContext,
  listingId: number,
  gallery: { key: string; value: string }[]
) => {
  let response: ListingGalleryExtraction[] = [];
  const imgDownloadInstance = axios.create({
    proxy: {
      protocol: "http",
      host: "x.botproxy.net",
      port: 8080,
      auth: {
        username: "pxu29513-0",
        password: "bUQDwQFlDCnWGPqqVJF1",
      },
    },
  });

  for (const photo of gallery) {
    let imgArrayRaw = photo.key.split("?");
    let imgOrigin = imgArrayRaw[0];

    let imgNameRaw = imgOrigin.split("/");

    let imgName = `${listingId}-${imgNameRaw[imgNameRaw.length - 1].replace(
      ".jpg",
      ".webp"
    )}`;

    let img = await imgDownloadInstance.get<ArrayBuffer>(photo.key, {
      responseType: "arraybuffer",
    });
    let dwn = Buffer.from(img.data);

    sharp(dwn)
      .webp()
      .toBuffer()
      .then((file) => {
        let params: PutObjectCommandInput = {
          Bucket: process.env.s3bucket,
          Key: imgName, // File name you want to save as in S3
          Body: file,
          ContentType: "image/webp",
        };
        AWSSvc.s3.send(new PutObjectCommand(params)).then(_=>{
          let updatedPhoto: ListingGalleryExtraction = {
            objectKey: `${imgName}`,
            origin: imgOrigin,
            caption: photo.value,
            imageId: imgName,
          };
          response.push(updatedPhoto);
        }).catch(e=>{
          throw e;
        })
        // AWSSvc.s3.upload(
        //   params,
        //   function (err: Error, data: ManagedUpload.SendData) {
        //     if (err) {
              
        //     } else {
        //       let updatedPhoto: ListingGalleryExtraction = {
        //         objectKey: data.Key,
        //         origin: imgOrigin,
        //         caption: photo.value,
        //         imageId: imgName,
        //       };
        //       response.push(updatedPhoto);
        //     }
        //   }
        // );
      });
  }
  //console.log("saveRemoteImagesToS3", response);
  return response;
};

export const objToBase64 = (data: object) => {
  let result = "";
  result = Buffer.from(JSON.stringify(data)).toString("base64");
  console.log(result);
  return result;
};

export const getListingSearch = async (
  api: APIRequestContext,
  request: AbnbSearchRequest
) => {
  let resp = await api.post(
    "https://www.airbnb.com/api/v3/StaysSearch?operationName=StaysSearch&locale=en&currency=USD",
    {
      data: request,
      headers: {
        "x-airbnb-api-key": "d306zoyjsyarp7ifhu67rjxn52tv0t20",
      },
    }
  );

  let rawBody = await resp.body();
  let jsonBody = JSON.parse(rawBody.toString());

  let search = jsonBody as SearchResponse;

  let response =
    search.data.presentation.explore.sections.sectionIndependentData.staysSearch.searchResults.map(
      (x) => {
        let item: ListingSearchExtraction = {
          isNew: x.listing.avgRatingLocalized === null?false:
            x.listing.avgRatingLocalized.toLowerCase() === "new" ? true : false,
          avgRating:
             x.listing.avgRatingLocalized === null
              ? 0
              :x.listing.avgRatingLocalized.toLowerCase() === "new"
              ? 0
              : parseFloat(x.listing.avgRatingLocalized.split(" ")[0]),
          coordinate: {
            latitude: x.listing.coordinate.latitude,
            longitude: x.listing.coordinate.longitude,
          },
          id: x.listing.id,
          name: x.listing.name,
          price:
            x.pricingQuote.structuredStayDisplayPrice.primaryLine.price ===
            undefined
              ? parseFloat(
                  x.pricingQuote.structuredStayDisplayPrice.primaryLine.originalPrice
                    .replace("USD", "")
                    .replace("$", "")
                    .trim()
                )
              : parseFloat(
                  x.pricingQuote.structuredStayDisplayPrice.primaryLine.price
                    .replace("USD", "")
                    .replace("$", "")
                    .trim()
                ),
        };
        return item;
      }
    );

  return response;
};
