import axios from "axios";
import {
  AbnbSearchRequest,
  ExtractionReq,
  AbnbSearchResponse,
  SQSEvent,
  VrboSearchRequest,
  VrboSearchResponse,
} from "./interfaces";
import {
  AbnbAvalibility,
  AbnbListing,
  AbnbListingList,
  AbnbReviews,
  AbnbUser,
  Day,
  ListingExtractionDetails,
  ListingGalleryExtraction,
  ListingReviewExtraction,
  ListingSearchExtraction,
  VrboAvalibility,
  VrboListing,
} from "./types";
import urlencode from "urlencode";
import sharp from "sharp";
import AWSSvc from "./s3";
import { APIRequestContext, APIResponse } from "playwright-chromium";
import { PutObjectCommand, PutObjectCommandInput } from "@aws-sdk/client-s3";
import { Point } from "geojson";
import { DataSource } from "typeorm";
import { LocationGeoLevel } from "./enums";
import { Location } from "./Location";
import { IsPointInsideTargetCountry } from "./IsPointInsideTargetCountry";
import { DateTime } from "luxon";

// const axiosExtractorInstance = axios.create({
//   responseType: "json",
//   headers: {
//     "X-Airbnb-API-Key": "d306zoyjsyarp7ifhu67rjxn52tv0t20",
//     "cache-control": "no-cache",
//     "user-agent": "PostmanRuntime/7.30.0",
//     accept: "*/*",
//     "accept-encoding": "br,gzip,deflate",
//     "connection":"keep-alive",
//     "Cookie":`_user_attributes=%7B%22guest_exchange%22%3A1%2C%22device_profiling_session_id%22%3A%221666794101--0419f310161d07c38a550ee0%22%2C%22giftcard_profiling_session_id%22%3A%221667317066--043d0629be277471ca93ed56%22%2C%22reservation_profiling_session_id%22%3A%221667317066--0d9147c44583b6c064758dcf%22%2C%22curr%22%3A%22USD%22%7D; ak_bmsc=85AABFA6B11183BCF2D449AEA8870284~000000000000000000000000000000~YAAQu9XdF9WW8eKFAQAAFB8xAxJzCKpCSmljm1o/7htbvbHlf7SWuacUdKIVTdomtnfoyu9yy1Dl7EnjOFA9ZEjnDKTfDU1/ORcn5fbi2EqSconDCVlwwVnc632POb5ACHS8wruy5UYiYlT4i7Z5CaHSMpqwvDVwI3CkK/awq9zSlsgpej/HsOJpZdegUyYiSZLxAzczPyNpPEsMyoMERf4qgZ/PP+MgMm4vmjbpSm7D90yrzCjUUpAvUbvIsuOZ96u7ZHwTLH/9yFWu6WcJEFyig0Q+8pU/y6dSZ1WJc3nQC/BdBDkcRQzeUK26uQUiDhZGWDcLSm55t5JNemWTbnujoRB9tDcGMF3GytOrBUT6hu/2OzWGpiaOXD+M; bev=1666793968_NDcwOWM5NmNiZjA5; country=NI; everest_cookie=1666794101.BcqdXAj0JoWr6P2miYzd.2sdY5WSxlmhuGFGFm9_bpqE3ibaDOGM9PdOqzLf20cI; jitney_client_session_created_at=1675090795; jitney_client_session_id=89bc48f4-680a-4e1a-a7a4-a5ae8167cae3; jitney_client_session_updated_at=1675090795; sticky_locale=en`
//   },
// });

export const getExtractionRequest = (event: SQSEvent) => {
  let response: ExtractionReq;
  let body = event.Records[0].body;
  response = JSON.parse(body) as ExtractionReq;
  return response;
};
//#region Airbnb
export const Abnb_getListing = async (
  api: APIRequestContext,
  listingId: string
): Promise<AbnbListing | null> => {
  let resp: APIResponse;
  let listing: AbnbListing | null = null;

  resp = await api.get(`https://www.airbnb.com/api/v1/listings/${listingId}`, {
    headers: {
      "x-airbnb-api-key": "d306zoyjsyarp7ifhu67rjxn52tv0t20",
    },
  });
  let rawBody = await resp.body();

  let jsonBody = JSON.parse(rawBody.toString());

  if (jsonBody.error_code === undefined) {
    listing = jsonBody as AbnbListing;
  } else {
    listing = null;
  }

  return listing;
};

export const Abnb_getListings = async (
  api: APIRequestContext,
  userId: string,
  listingCount: number,
  dataSource: DataSource
) => {
  const repo = dataSource.getRepository(Location);
  let countries = await repo.find({
    where: { polygonGeoLevel: LocationGeoLevel.Country },
  });

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

  let response: ListingExtractionDetails[] = [];

  if (listing.user_promo_listings.length > 0) {
    for (const l of listing.user_promo_listings) {
      let unit = await Abnb_getListing(api, l.id.toString());

      if (unit !== null) {
        let point: Point = {
          type: "Point",
          coordinates: [unit.listing.lat, unit.listing.lng],
        };
        if (IsPointInsideTargetCountry(point, countries)) {
          let details = {
            baths: unit.listing.bathrooms,
            bedrooms: unit.listing.bedrooms,
            beds: unit.listing.beds,
            costPerNight: unit.listing.price,
            maxOccupancy: unit.listing.person_capacity,
            description: unit.listing.description,
            title: unit.listing.name,
            reviews: unit.listing.reviews_count,
            lat: unit.listing.lat,
            lng: unit.listing.lng,
            photos: unit.listing.photos.map((x) => {
              let response: ListingGalleryExtraction = {
                imageId: x.id.toString(),
                origin: x.xl_picture,
                objectKey: "",
                caption: x.caption,
              };
              return response;
            }),
          };
          response.push(details);
        }
      }
    }
  }

  return response;
};

export const Abnb_getReviews = async (
  api: APIRequestContext,
  listingId: string,
  limit: number
) => {
  let rawVars = `{"request":{"fieldSelector":"for_p3","limit":${limit},"listingId":"${listingId}","numberOfAdults":"1","numberOfChildren":"0","numberOfInfants":"0"}}`;
  let rawExt = `{"persistedQuery":{"version":1,"sha256Hash":"6a71d7bc44d1f4f16cced238325ced8a93e08ea901270a3f242fd29ff02e8a3a"}}`;
  let variables = urlencode(rawVars);
  let extentions = urlencode(rawExt);

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

  return reviews;
};

export const Abnb_getAvailalibity = async (
  api: APIRequestContext,
  listingId: string,
  dateStart: string,
  dateEnd: string
) => {
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
  return calendar;
};

export const Abnb_getUser = async (api: APIRequestContext, userId: string) => {
  let resp = await api.get(`https://airbnb.com/api/v2/users/${userId}`, {
    headers: {
      "x-airbnb-api-key": "d306zoyjsyarp7ifhu67rjxn52tv0t20",
    },
  });

  let rawBody = await resp.body();
  let jsonBody = JSON.parse(rawBody.toString());

  let user = jsonBody as AbnbUser;
  return user;
};

export const Abnb_getListingSearch = async (
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

  let search = jsonBody as AbnbSearchResponse;

  let response =
    search.data.presentation.explore.sections.sectionIndependentData.staysSearch.searchResults.map(
      (x) => {
        let item: ListingSearchExtraction = {
          isNew:
            x.listing.avgRatingLocalized === null
              ? false
              : x.listing.avgRatingLocalized.toLowerCase() === "new"
              ? true
              : false,
          avgRating:
            x.listing.avgRatingLocalized === null
              ? 0
              : x.listing.avgRatingLocalized.toLowerCase() === "new"
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
//#endregion

//#region Vrbo
export const Vrbo_getListing = async (
  api: APIRequestContext,
  listingId: string,
  reviewsCount: number
) => {
  let resp: APIResponse;
  let response: VrboListing;

  resp = await api.post(`https://www.vrbo.com/mobileapi/graphql`, {
    headers: {
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Content-Type": "application/json",
      Host: "www.vrbo.com",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      TE: "trailers",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.0",
    },
    data: {
      operationName: "Listing",
      variables: {
        listingId: listingId,
      },
      query:
        "query Listing($listingId: String!) {\n  listing(listingId: $listingId) {\n availabilityCalendar {availability\n {\n minStayDefault \n} \n} \n averageRating\n listingId\n listingNumber\n address {city\n}\n priceSummary {amount\n}\n geoCode {latitude\n longitude\n}\n geography {description\n}\n propertyName\n description\n sleeps\n spaces {spacesSummary{bathroomCount\n bedroomCount\n toiletOnlyCount\n bedCountDisplay\n}\n}\n  images {uri\n caption\n}\n} \n}",
    },
  });
  let rawBody = await resp.body();

  let jsonBody = JSON.parse(rawBody.toString());
  let locDescription = String(
    jsonBody.data.listing.geography.description
  ).split(",");
  response = {
    listing: {
      id: Number(jsonBody.data.listing.listingNumber),
      city: String(jsonBody.data.listing.address.city),
      price: Number(jsonBody.data.listing.priceSummary.amount),
      lat: Number(jsonBody.data.listing.geoCode.latitude),
      lng: Number(jsonBody.data.listing.geoCode.longitude),
      country: locDescription[locDescription.length - 1].trim(),
      name: String(jsonBody.data.listing.propertyName),
      bathrooms:
        jsonBody.data.listing.spaces.spacesSummary.toiletOnlyCount !== 0
          ? parseInt(
              `${jsonBody.data.listing.spaces.spacesSummary.bathroomCount}.${jsonBody.data.listing.spaces.spacesSummary.toiletOnlyCount}`
            )
          : Number(jsonBody.data.listing.spaces.spacesSummary.bathroomCount),
      bedrooms: Number(jsonBody.data.listing.spaces.spacesSummary.bedroomCount),
      beds: parseInt(
        String(
          jsonBody.data.listing.spaces.spacesSummary.bedCountDisplay
        ).split(" ")[0]
      ),
      min_nights: Number(
        jsonBody.data.listing.availabilityCalendar.availability.minStayDefault
      ),
      person_capacity: Number(jsonBody.data.listing.sleeps),
      reviews_count: reviewsCount,
      picture_count: Array(jsonBody.data.listing.images).length,
      description: String(jsonBody.data.listing.description),
      photos: jsonBody.data.listing.images,
    },
  };

  return response;
};

export const Vrbo_getReviews = async (
  api: APIRequestContext,
  listingId: string,
  reviewsCount: number
) => {
  let resp = await api.post("https://www.vrbo.com/mobileapi/graphql", {
    headers: {
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Content-Type": "application/json",
      Host: "www.vrbo.com",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      TE: "trailers",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.0",
    },
    data: {
      operationName: "Reviews",
      variables: {
        isInitial: false,
        listingId: listingId,
        page: 1,
        pageSize: reviewsCount,
      },
      query:
        "query Reviews($isInitial: Boolean = false, $listingId: String!, $page: Int!, $pageSize: Int!) {\n  reviews(listingId: $listingId, page: $page, pageSize: $pageSize) {\n    uuid\n    headline: title\n    rating\n    body: text\n    arrivalDate\n    datePublished\n    ownershipTransferred\n    voteCount\n    reviewLanguage\n    reviewer {\n      location\n      nickname\n      profileUrl\n      __typename\n    }\n    response: reviewResponse {\n      status\n      body\n      language\n      country\n      __typename\n    }\n    source\n    unverifiedDisclaimer\n    __typename\n  }\n  reviewSummary(listingId: $listingId) @include(if: $isInitial) {\n    reviewCount\n    guestbookReviewCount\n    averageRating\n    verificationDisclaimerLinkText\n    verificationDisclaimerLinkUrl\n    verificationDisclaimerText\n    __typename\n  }\n}\n",
    },
  });

  let rawBody = await resp.body();
  let reviewsJson = JSON.parse(rawBody.toString());
  let reviews = reviewsJson.data.reviews;

  let response = reviews.map((x) => {
    let rev: ListingReviewExtraction = {
      reviewId: x.uuid,
      title: x.headline,
      rating: x.rating,
      date: x.datePublished,
      author: x.reviewer.nickname,
      comment: x.body,
      response: x.response === null ? "" : x.response.body,
    };
    return rev;
  });

  return response as ListingReviewExtraction[];
};

export const Vrbo_getAvailalibity = async (
  api: APIRequestContext,
  listingId: string
) => {
  let resp: APIResponse;
  resp = await api.post(`https://www.vrbo.com/mobileapi/graphql`, {
    headers: {
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Content-Type": "application/json",
      Host: "www.vrbo.com",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      TE: "trailers",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.0",
    },
    data: {
      operationName: "Listing",
      variables: {
        listingId: listingId,
      },
      query:
        "query Listing($listingId: String!) {\n  listing(listingId: $listingId) {\n availabilityCalendar {availability\n {\n dateRange {endDate \nbeginDate\n} unitAvailabilityConfiguration { availability\n maxStay\n } \n} \n} \n} \n}",
    },
  });
  let rawBody = await resp.body();

  let jsonBody = JSON.parse(rawBody.toString());

  let start = DateTime.fromISO(
    jsonBody.data.listing.availabilityCalendar.availability.dateRange.beginDate
  );
  let end = start.plus({ year: 1 });

  let days = String(
    jsonBody.data.listing.availabilityCalendar.availability
      .unitAvailabilityConfiguration.availability
  );

  let dayList: Day[] = [];
  for (const d of days) {
    if (start <= end) {
      let dy = start.toISO();
      let currentDay: Day = {
        date: dy,
        available: d === "Y" ? true : false,
      };

      dayList.push(currentDay);
      start = start.plus({ day: 1 });
    } else {
      break;
    }
  }

  let response: VrboAvalibility = {
    calendar: { days: dayList },
  };

  return response;
};

export const Vrbo_getUser = async (
  api: APIRequestContext,
  listingId: string
) => {
  let resp: APIResponse;
  resp = await api.post(`https://www.vrbo.com/mobileapi/graphql`, {
    headers: {
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Content-Type": "application/json",
      Host: "www.vrbo.com",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      TE: "trailers",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.0",
    },
    data: {
      operationName: "Listing",
      variables: {
        listingId: listingId,
      },
      query:
        "query Listing($listingId: String!) {\n  listing(listingId: $listingId) {\n contact {\n name \n memberSince\n }\n} \n}",
    },
  });
  let rawBody = await resp.body();

  let jsonBody = JSON.parse(rawBody.toString());

  console.log(jsonBody);

  let usr: AbnbUser = {
    user: {
      about: "",
      acceptance_rate: "",
      bookings: 0,
      created_at: jsonBody.data.listing.contact.memberSince,
      first_name: jsonBody.data.listing.contact.name,
      has_available_payout_info: false,
      has_profile_pic: false,
      id: 0,
      identity_verified: false,
      listings_count: 0,
      location: "",
      picture_url: "",
      picture_url_large: "",
      recommendation_count: 0,
      response_rate: "",
      response_time: "",
      reviewee_count: 0,
      school: "",
      thumbnail_medium_url: "",
      thumbnail_url: "",
      total_listings_count: 0,
      trips: 0,
      verification_labels: [],
      verifications: [],
      work: "",
    },
  };
  return usr;
};

export const Vrbo_getListingSearch = async (
  api: APIRequestContext,
  request: VrboSearchRequest
) => {
  let originalResponse = await api.post("https://www.vrbo.com/serp/g", {
    data: request,
    headers: {
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Content-Type": "application/json",
      Host: "www.vrbo.com",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      TE: "trailers",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.0",
    },
  });

  let rawBody = await originalResponse.body();
  let jsonBody = JSON.parse(rawBody.toString());

  let originalSearch = jsonBody.data as VrboSearchResponse;

  request.variables.request.paging.page = 1;
  request.variables.request.paging.pageSize =
    originalSearch.results.resultCount;
  let completeResponse = await api.post("https://www.vrbo.com/serp/g", {
    data: request,
    headers: {
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Content-Type": "application/json",
      Host: "www.vrbo.com",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      TE: "trailers",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.0",
    },
  });

  let rawBodyComplete = await completeResponse.body();
  let jsonBodyComplete = JSON.parse(rawBodyComplete.toString());

  let completeSearch = jsonBodyComplete.data as VrboSearchResponse;

  let response = completeSearch.results.listings.map((x) => {
    let item: ListingSearchExtraction = {
      isNew: false,
      avgRating: x.averageRating,
      coordinate: {
        latitude: x.geoCode.latitude,
        longitude: x.geoCode.longitude,
      },
      id: x.propertyId,
      ref: x.listingId,
      name: x.propertyMetadata.headline,
      price: x.prices.perNight.amount,
    };
    return item;
  });

  return response;
};

//#endregion

//#region Utilities
export const saveRemoteImagesToS3 = async (
  api: APIRequestContext,
  listingId: string,
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

    let imgName = `${listingId}-${imgNameRaw[imgNameRaw.length - 1]
      .replace(".jpg", ".webp")
      .replace(".jpeg", ".webp")}`;
    try {
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
          AWSSvc.s3
            .send(new PutObjectCommand(params))
            .then((_) => {
              let updatedPhoto: ListingGalleryExtraction = {
                objectKey: `${imgName}`,
                origin: imgOrigin,
                caption: photo.value,
                imageId: imgName,
              };
              response.push(updatedPhoto);
            })
            .catch((e) => {
              throw e;
            });
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
    } catch (e: any) {
      console.log("Skipped: Error while acquiring image from remote server");
      continue;
    }
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

//#endregion
