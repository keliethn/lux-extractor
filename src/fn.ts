import axios from "axios";
import {
  SQSEvent,
  ExtractionReq,
  AbnbSearchRequest,
  VrboSearchRequest,
  AbnbSearchResponse,
  VrboSearchResponse,
} from "./interfaces";
import {
  Day,
  AbnbUser,
  AbnbListing,
  AbnbReviews,
  VrboListing,
  AbnbAvalibility,
  AbnbListingList,
  VrboAvalibility,
  ListingReviewExtraction,
  ListingSearchExtraction,
  ListingGalleryExtraction,
} from "./types";
import urlencode from "urlencode";
import sharp from "sharp";
import AWSSvc from "./s3";
import { APIRequestContext, APIResponse, Page } from "playwright-chromium";
import { PutObjectCommand, PutObjectCommandInput } from "@aws-sdk/client-s3";
import { DateTime } from "luxon";
import { HTMLElement, parse } from "node-html-parser";

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
  listingCount: number
  //dataSource: DataSource
) => {
  // const repo = dataSource.getRepository(Location);
  // let countries = await repo.find({
  //   where: { polygonGeoLevel: LocationGeoLevel.Country },
  // });

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

  let response: ListingSearchExtraction[] = [];

  if (listing.user_promo_listings.length > 0) {
    for (const l of listing.user_promo_listings) {
      //let unit = await Abnb_getListing(api, l.id_str);
      // if (unit !== null) {
      let details: ListingSearchExtraction = {
        avgRating: 0,
        isNew: false,
        // coordinate: {
        //   latitude: unit.listing.lat,
        //   longitude: unit.listing.lng,
        // },
        id: l.id_str,
        name: l.name,
        price: parseFloat(l.nightly_price_as_guest),
        thumbnail: l.picture_url,
        hostId: userId,
      };
      response.push(details);

      // }
    }
  }

  return response;
};

export const Abnb_getListingsLookup = async (
  api: APIRequestContext,
  userId: string,
  listingCount: number
) => {
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

  let response: ListingSearchExtraction[] = [];

  if (listing.user_promo_listings.length > 0) {
    for (const l of listing.user_promo_listings) {
      let unit = await Abnb_getListing(api, l.id.toString());

      if (unit !== null) {
        let details: ListingSearchExtraction = {
          avgRating: 0,
          isNew: false,
          coordinate: {
            latitude: unit.listing.lat,
            longitude: unit.listing.lng,
          },
          id: String(unit.listing.id),
          name: unit.listing.name,
          price: unit.listing.price,
          thumbnail: unit.listing.thumbnail_url,
          hostId: unit.listing.primary_host.id.toString(),
        };
        response.push(details);
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
  let reviews: AbnbReviews[] = [];
  let pages = Math.ceil(limit / 50);
  let pageArray: number[] = [];
  for (let index = 0; index < pages; index++) {
    pageArray.push(index);
  }

  for (const pg of pageArray) {
    let offset = 50 * pg;
    let rawVars = `{"request":{"fieldSelector":"for_p3","limit":"50","listingId":"${listingId}","numberOfAdults":"1","offset":"${offset}","numberOfChildren":"0","numberOfInfants":"0"}}`;
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

    reviews.push(jsonBody as AbnbReviews);
    //let reviews = jsonBody as AbnbReviews;
  }

  console.log(reviews.length);

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

export const Abnb_getHost = async (api: APIRequestContext, userId: string) => {
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

export const Abnb_getPriceRanges = async (
  api: APIRequestContext,
  data: { key: string; value: string }[]
) => {};

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
  console.log(rawBody.toString());
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
        "query Listing($listingId: String!) {\n  listing(listingId: $listingId) {\n availabilityCalendar {availability\n {\n minStayDefault \n} \n} \n averageRating\n listingId\n listingNumber\n propertyTypeKey\n thumbnailUrl\n address {city\n}\n priceSummary {amount\n}\n geoCode {latitude\n longitude\n}\n geography {description\n}\n propertyName\n description\n sleeps\n spaces {spacesSummary{bathroomCount\n bedroomCount\n toiletOnlyCount\n bedCountDisplay\n}\n}\n  images {uri\n caption\n}\n} \n}",
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
      thumbnail_url: String(jsonBody.data.listing.thumbnailUrl),
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
      property_type: String(jsonBody.data.listing.propertyTypeKey),
      room_type_category: String(jsonBody.data.listing.propertyTypeKey),
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

  let response: ListingReviewExtraction[] = [];
  if (reviews !== null) {
    response = reviews.map((x) => {
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
  }

  return response;
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
  let arrayDate = start.minus({ day: 1 });
  for (let index = 1; index < 366; index++) {
    let dy = arrayDate.plus({ day: index }).toISO();
    let d = days[index - 1];
    let currentDay: Day = {
      date: dy,
      available: d === "Y" ? true : false,
    };

    dayList.push(currentDay);
  }
  // for (const d of days) {
  //   if (start <= end) {
  //     let dy = start.toISO();
  //     let currentDay: Day = {
  //       date: dy,
  //       available: d === "Y" ? true : false,
  //     };

  //     dayList.push(currentDay);
  //     start = start.plus({ day: 1 });
  //   } else {
  //     break;
  //   }
  // }

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

      const image = sharp(dwn);
      const metadata = await image.metadata();

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
                width: metadata.width,
                height: metadata.height,
              };
              response.push(updatedPhoto);
            })
            .catch((e) => {
              throw e;
            });
        });
    } catch (e: any) {
      console.log("Skipped: Error while acquiring image from remote server");
      continue;
    }
  }
  return response;
};

export const objToBase64 = (data: object) => {
  let result = "";
  result = Buffer.from(JSON.stringify(data)).toString("base64");
  return result;
};

export const getRealMinMax = async (min: number, max: number, page: Page) => {
  let response = 0;
  let totalListings = 0;
  let btnListings = await page.textContent(
    'a[data-testid="filter-modal-confirm"]'
  );
  if (btnListings !== null) {
    totalListings = parseInt(btnListings.replace(/\D/g, ""));
  }

  if (totalListings < 1000) {
    let entireRangeListings: number = 0;
    await page.fill("#price_filter_min", min.toString());
    await page.fill("#price_filter_max", max.toString());
    const input = await page.$("#price_filter_max");
    if (input !== null) {
      await input.evaluate((element) => element.blur());
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
      let btnListings = await page.textContent(
        'a[data-testid="filter-modal-confirm"]'
      );
      if (btnListings !== null) {
        entireRangeListings = parseInt(btnListings.replace(/\D/g, ""));
      }

      if (entireRangeListings < totalListings) {
        let newTotalListings = 0;
        let newMax = max;
        while (newTotalListings < totalListings) {
          let l = 0;
          newMax = newMax + Math.trunc(newMax / 2);
          await page.fill("#price_filter_min", min.toString());
          await page.fill("#price_filter_max", newMax.toString());
          const input = await page.$("#price_filter_max");
          if (input !== null) {
            await input.evaluate((element) => element.blur());
            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(1200);
            let btnListings = await page.textContent(
              'a[data-testid="filter-modal-confirm"]'
            );
            if (btnListings !== null) {
              l = parseInt(btnListings.replace(/\D/g, ""));
            }
            newTotalListings = l;
          }
        }
        response = newMax;
      } else {
        response = max;
      }
    } else {
      response = max;
    }
  }
  return response;
};

export const extractListingCount = async (
  min: number,
  max: number,
  page: Page
) => {
  let listings: number = 0;
  await page.fill("#price_filter_min", min.toString());
  await page.fill("#price_filter_max", max.toString());
  const input = await page.$("#price_filter_max");
  if (input !== null) {
    await input.evaluate((element) => element.blur());
   
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);

   
    let btnListings = await page.textContent(
      'div[data-testid="modal-container"] a'
    );
    console.log(btnListings);
    if (btnListings !== null) {
      listings = parseInt(btnListings.replace(/\D/g, ""));
    }
  }

  return listings;
};

export const priceRangeLookup = async (
  minSeed: number,
  maxSeed: number,
  page: Page
) => {
  let ranges: { min: number; max: number; count: number }[] = [];

  let innerMax = maxSeed;
  let lowerRangeFound = false;

  while (lowerRangeFound === false) {
    let parentListings = await extractListingCount(minSeed, innerMax, page);
    console.log(parentListings);
    if (parentListings <= 230) {
      ranges.push({ min: minSeed, max: innerMax, count: parentListings });
      // console.log(
      //   `Min: ${minSeed} | Max: ${innerMax} | Listings: ${parentListings}`
      // );
      lowerRangeFound = true;
    } else {
      let parentRangeDiff = innerMax - minSeed;
      if (parentRangeDiff <= 1) {
        ranges.push({ min: minSeed, max: innerMax, count: parentListings });
        // console.log(
        //   `Min: ${minSeed} | Max: ${innerMax} | Listings: ${parentListings}`
        // );
        lowerRangeFound = true;
      } else {
        let higherRangeFound = false;
        let minChild = minSeed;
        let childListings = 0;
        while (higherRangeFound === false) {
          minChild = innerMax - Math.trunc((innerMax - minChild) / 1.2);
          childListings = await extractListingCount(minChild, innerMax, page);

          let childRangeDiff = innerMax - minChild;
          if (childListings <= 230) {
            // console.log(
            //   `Min: ${minChild} | Max: ${innerMax} | Listings: ${childListings}`
            // );
            ranges.push({
              min: minChild,
              max: innerMax,
              count: childListings,
            });
            innerMax = minChild - 1;
            higherRangeFound = true;
          } else if (childRangeDiff <= 1) {
            // console.log(
            //   `Min: ${minChild} | Max: ${innerMax} | Listings: ${childListings}`
            // );
            ranges.push({
              min: minChild,
              max: innerMax,
              count: childListings,
            });
            if (childRangeDiff === 0) {
              innerMax = minChild - 1;
            } else {
              innerMax = minChild;
            }

            higherRangeFound = true;
          }
        }
      }
    }
  }

  return ranges;
};

export const saveRemoteImagesToS3V2 = async (
  listingId: string,
  gallery: string[]
) => {
  let response: ListingGalleryExtraction[] = [];
  const imgDownloadInstance = axios.create();

  for (const photo of gallery) {
    let imgArrayRaw = photo.split("?");
    let imgOrigin = imgArrayRaw[0];

    let imgNameRaw = imgOrigin.split("/");

    let imgName = `${listingId}-${imgNameRaw[imgNameRaw.length - 1]
      .replace(".jpg", ".webp")
      .replace(".jpeg", ".webp")}`;
    try {
      let img = await imgDownloadInstance.get<ArrayBuffer>(photo, {
        responseType: "arraybuffer",
      });
      let dwn = Buffer.from(img.data);

      const image = sharp(dwn);
      const metadata = await image.metadata();

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
                imageId: imgName,
                width: metadata.width,
                height: metadata.height,
              };
              response.push(updatedPhoto);
            })
            .catch((e) => {
              throw e;
            });
        });
    } catch (e: any) {
      console.log("Skipped: Error while acquiring image from remote server");
      continue;
    }
  }
  return response;
};

//#endregion

//#region Agnostic HTML Lookup

export class HtmlLookupRepo {
  private _originalHtml: HTMLElement;
  private _htmlFragment: HTMLElement;
  private _htmlWorkingElements: HTMLElement[] = [];
  private _selectedElements: HTMLElement[] = [];
  private _selectedValues: { [key: string]: any }[] = [];
  private _predicate: lookupPredicate = {};
  private _elementAttrib: elementAttribs | null = null;

  constructor(html: string | HTMLElement) {
    this._originalHtml = typeof html === "string" ? parse(html) : html;
    this._htmlFragment = this._originalHtml;
  }

  parent(attribute: string, value: string) {
    const candidate = this._originalHtml.querySelector(
      `[${attribute}="${value}"]`
    );
    //console.log(value,candidate)
    if (candidate !== null) {
      this._htmlFragment = candidate;
    } else {
      this._htmlFragment = this._originalHtml;
    }
    return this;
  }

  from(element: elementType) {
    this._htmlWorkingElements = this._htmlFragment.querySelectorAll(
      `${element}`
    );

    return this;
  }

  select(attrib: elementAttribs | null) {
    this._elementAttrib = attrib;
    return this;
  }

  where(predicate: lookupPredicate) {
    this._predicate = predicate;
    if (this._htmlWorkingElements.length > 0) {
      for (const element of this._htmlWorkingElements) {
        let matchCount = 0;
        let predicateKeys = Object.keys(predicate);
        //console.log(predicateKeys)
        for (const key of predicateKeys) {
          if (key !== "innerText" && key !== "textContent") {
            let predicateCondition = predicate[key];

            let attribute = element.getAttribute(key);

            //console.log("attribute",attribute);
            if (typeof predicateCondition === "string") {
              if (attribute !== undefined) {
                if (attribute === predicateCondition) {
                  matchCount += 1;
                }
              }
            } else if (predicateCondition instanceof RegExp) {
              if (attribute !== undefined) {
                let match = attribute.match(predicateCondition);

                if (match !== null) {
                  matchCount += 1;
                }
              }
            } else {
              if (
                this.evaluateLogicSearch(attribute, predicateCondition) === true
              ) {
                matchCount += 1;
              }
            }
          } else {
            let predicateCondition = predicate[key];
            let attribute: string | undefined = undefined;
            if (key === "innerText") {
              attribute = element.innerText;
            } else if (key === "textContent") {
              attribute = element.textContent;
            }

            if (typeof predicateCondition === "string") {
              if (attribute !== undefined) {
                if (attribute === predicateCondition) {
                  matchCount += 1;
                }
              }
            } else if (predicateCondition instanceof RegExp) {
              if (attribute !== undefined) {
                let match = attribute.match(predicateCondition);
                if (match !== null) {
                  matchCount += 1;
                }
              }
            } else {
              if (
                this.evaluateLogicSearch(attribute, predicateCondition) === true
              ) {
                matchCount += 1;
              }
            }
          }
        }

        if (matchCount > 0) {
          this._selectedElements.push(element);
          //console.log(this._elementAttrib)
          if (this._elementAttrib !== null) {
            let attr: string | undefined = undefined;
            if (
              this._elementAttrib !== "innerText" &&
              this._elementAttrib !== "textContent"
            ) {
              attr = element.getAttribute(this._elementAttrib);
              //console.log(attr)
            } else {
              if (this._elementAttrib === "innerText") {
                attr = element.innerText;
              } else if (this._elementAttrib === "textContent") {
                attr = element.textContent;
              }
            }
            let obj: { [key: string]: any } = {};

            let keyNm = this._elementAttrib;
            obj[keyNm] = attr;

            //console.log(obj)
            this._selectedValues.push(obj);
          }
        }
      }
    }

    return this;
  }

  getManyElements() {
    let response: HTMLElement[] = [];
    if (this._selectedElements.length > 0) {
      response = [...this._selectedElements];
    } else if (this._htmlWorkingElements.length > 0) {
      response = [...this._htmlWorkingElements];
    }
    this._selectedElements = [];
    return response;
  }

  getSingleElement() {
    let response: HTMLElement | null = null;
    if (this._selectedElements.length > 0) {
      response = this._selectedElements[0];
    } else if (this._htmlWorkingElements.length > 0) {
      response = this._htmlWorkingElements[0];
    }
    this._selectedElements = [];

    //console.log(response)
    return response;
  }

  getManyValues() {
    let response: { [key: string]: any }[] = [];
    if (this._selectedValues.length === 0) {
      if (
        this._htmlWorkingElements.length > 0 &&
        this._elementAttrib !== null
      ) {
        for (const element of this._htmlWorkingElements) {
          let obj: { [key: string]: any } = {};
          if (
            this._elementAttrib !== "innerText" &&
            this._elementAttrib !== "textContent"
          ) {
            obj[this._elementAttrib] = element.getAttribute(
              this._elementAttrib
            );
            response.push(obj);
          } else {
            if (this._elementAttrib === "innerText") {
              obj[this._elementAttrib] = element.innerText;
              response.push(obj);
            } else if (this._elementAttrib === "textContent") {
              obj[this._elementAttrib] = element.textContent;
              response.push(obj);
            }
          }
        }
      }
    } else {
      response = this._selectedValues;
    }
    this._selectedValues = [];
    return response;
  }

  getSingleValue() {
    let response: { [key: string]: any } = {};
    let valuesArray: { [key: string]: any }[] = [];
    if (this._selectedValues.length === 0) {
      if (
        this._htmlWorkingElements.length > 0 &&
        this._elementAttrib !== null
      ) {
        for (const element of this._htmlWorkingElements) {
          let obj: { [key: string]: any } = {};
          if (
            this._elementAttrib !== "innerText" &&
            this._elementAttrib !== "textContent"
          ) {
            obj[this._elementAttrib] = element.getAttribute(
              this._elementAttrib
            );
            valuesArray.push(obj);
          } else {
            if (this._elementAttrib === "innerText") {
              obj[this._elementAttrib] = element.innerText;
              valuesArray.push(obj);
            } else if (this._elementAttrib === "textContent") {
              obj[this._elementAttrib] = element.textContent;
              valuesArray.push(obj);
            }
          }
        }
      }
    } else {
      valuesArray = this._selectedValues;
    }
    this._selectedValues = [];

    if (valuesArray.length > 0) {
      response = valuesArray[0];
    }
    return response;
  }

  private evaluateLogicSearch(attribute: string, predicate: lookupLogicSearch) {
    let response = false;
    let totalConditionals = Object.keys(predicate).length;
    let totalMatches = 0;
    for (const key of Object.keys(predicate)) {
      switch (key) {
        case "length":
          let totalSubconditionals = Object.keys(predicate[key]).length;
          let subconditionalsMatches = 0;
          for (const subkey of Object.keys(predicate[key])) {
            let conditionToTest = Number(predicate[key][subkey]);
            switch (subkey) {
              case "greaterThan":
                if (attribute.length > conditionToTest) {
                  subconditionalsMatches++;
                }
                break;
              case "greaterOrEqualTo":
                if (attribute.length >= conditionToTest) {
                  subconditionalsMatches++;
                }
                break;
              case "equalTo":
                if (attribute.length === conditionToTest) {
                  subconditionalsMatches++;
                }
                break;
              case "lessThan":
                if (attribute.length < conditionToTest) {
                  subconditionalsMatches++;
                }
                break;
              case "lessOrEqualTo":
                if (attribute.length <= conditionToTest) {
                  subconditionalsMatches++;
                }
                break;

              case "not":
                if (attribute.length !== conditionToTest) {
                  subconditionalsMatches++;
                }
                break;
            }
          }
          if (totalSubconditionals === subconditionalsMatches) {
            totalMatches++;
          }
          break;
        case "data":
          break;
      }
    }
    if (totalConditionals === totalMatches) {
      response = true;
    }
    return response;
  }
}

export const HtmlLookup = (
  data: string | HTMLElement,
  template: LookupTemplate
) => {
  let response: { [key: string]: any } = {};
  const repo = new HtmlLookupRepo(data);
  for (const key of Object.keys(template)) {
    let item = template[key];
    let lookup: HtmlLookupRepo;
    if (item.parent !== undefined) {
      lookup = repo
        .parent(item.parent.attribute, item.parent.value)
        .from(item.from)
        .select(item.select);
    } else {
      lookup = repo.from(item.from).select(item.select);
    }

    if (item.where !== undefined) {
      lookup.where(item.where);
    }

    if (item.singleValue !== undefined) {
      if (item.singleValue === true) {
        let single = lookup.getSingleValue();

        if (item.returnType === "string") {
          let singleStringData = String(single[item.select]);

          if (item.stringTransformer !== undefined) {
            const selectedText = singleStringData.match(item.stringTransformer);

            if (selectedText) {
              response[key] = selectedText[0];
            } else {
              response[key] = "";
            }
          } else {
            response[key] = singleStringData;
          }
        } else if (item.returnType === "integer") {
          const textWithoutEntities = (single[item.select] as string).replace(
            /&nbsp;/g,
            " "
          );
          const pattern = /(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
          const matches = textWithoutEntities.match(pattern);
          const uniqueMatches = [...new Set(matches)];
          response[key] = parseInt(uniqueMatches[0]);
        } else if (item.returnType === "float") {
          const textWithoutEntities = (single[item.select] as string).replace(
            /&nbsp;/g,
            " "
          );
          const pattern = /(\d+(?:,\d{3})*(?:\.\d{1,2})?)/g;
          const matches = textWithoutEntities.match(pattern);
          const uniqueMatches = [...new Set(matches)];
          response[key] = parseFloat(uniqueMatches[0]);
        }
      } else {
        let multiple = lookup.getManyValues();
        if (item.returnType === "string") {
          response[key] = multiple.map((x) => {
            let r = "";
            let singleStringData = String(x[item.select]);
            if (item.stringTransformer !== undefined) {
              const numericChars = singleStringData.match(
                item.stringTransformer
              );
              if (numericChars) {
                r = numericChars[0];
              } else {
                r = "";
              }
            } else {
              r = singleStringData;
            }
            return r;
          });
        } else if (item.returnType === "integer") {
          response[key] = multiple.map((x) => {
            const textWithoutEntities = (x[item.select] as string).replace(
              /&nbsp;/g,
              " "
            );
            const pattern = /(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
            const matches = textWithoutEntities.match(pattern);
            const uniqueMatches = [...new Set(matches)];
            //response[key] = parseInt(uniqueMatches[0]);
            return parseInt(uniqueMatches[0]);
          });
        } else if (item.returnType === "float") {
          response[key] = multiple.map((x) => {
            const textWithoutEntities = (x[item.select] as string).replace(
              /&nbsp;/g,
              " "
            );
            const pattern = /(\d+(?:,\d{3})*(?:\.\d{1,2})?)/g;
            const matches = textWithoutEntities.match(pattern);
            const uniqueMatches = [...new Set(matches)];
            return parseFloat(uniqueMatches[0]);
          });
        }
      }
    } else {
      let multiple = lookup.getManyValues();
      if (item.returnType === "string") {
        response[key] = multiple.map((x) => {
          let r = "";
          let singleStringData = String(x[item.select]);
          if (item.stringTransformer !== undefined) {
            const numericChars = singleStringData.match(item.stringTransformer);
            if (numericChars) {
              r = numericChars[0];
            } else {
              r = "";
            }
          } else {
            r = singleStringData;
          }
          return r;
        });
      } else if (item.returnType === "integer") {
        response[key] = multiple.map((x) => {
          const textWithoutEntities = (x[item.select] as string).replace(
            /&nbsp;/g,
            " "
          );
          const pattern = /(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
          const matches = textWithoutEntities.match(pattern);
          const uniqueMatches = [...new Set(matches)];
          return parseInt(uniqueMatches[0]);
        });
      } else if (item.returnType === "float") {
        response[key] = multiple.map((x) => {
          const textWithoutEntities = (x[item.select] as string).replace(
            /&nbsp;/g,
            " "
          );
          const pattern = /(\d+(?:,\d{3})*(?:\.\d{1,2})?)/g;
          const matches = textWithoutEntities.match(pattern);
          const uniqueMatches = [...new Set(matches)];
          return parseFloat(uniqueMatches[0]);
        });
      }
    }
  }

  return response;
};

export interface LookupTemplate {
  [key: string]: {
    parent?: lookupParent;
    from: elementType;
    select: elementAttribs;
    where?: lookupPredicate;
    returnType: "string" | "integer" | "float";
    stringTransformer?: RegExp;
    singleValue?: boolean;
  };
}

interface lookupParent {
  attribute: string;
  value: string;
}

interface lookupPredicate {
  [key: elementAttribs]: string | RegExp | lookupLogicSearch;
}

type lookupLogicSearch = {
  [key in elementAttribs]: lookupLogicSearchElement;
};

interface lookupLogicSearchElement {
  equalTo?: number | string;
  greaterThan?: number;
  greaterOrEqualTo?: number;
  lessThan?: number;
  lessOrEqualTo?: number;
  not?: number | string;
  contains?: string;
}

type elementType =
  | "div"
  | "span"
  | "p"
  | "a"
  | "img"
  | "ul"
  | "li"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "input"
  | "button"
  | "form"
  | "table"
  | "tr"
  | "td"
  | "header"
  | "nav"
  | "section"
  | "article"
  | "aside"
  | "footer"
  | "strong"
  | "em"
  | "br"
  | "hr"
  | "label"
  | "select"
  | "option"
  | "textarea"
  | "iframe"
  | "script"
  | "style"
  | "meta"
  | "link"
  | "head"
  | "body"
  | "html"
  | "main"
  | "video"
  | "audio"
  | "source"
  | "canvas"
  | "b"
  | "i";

type elementAttribs =
  | "id"
  | "class"
  | "style"
  | "src"
  | "href"
  | "alt"
  | "value"
  | "type"
  | "name"
  | "placeholder"
  | "checked"
  | "disabled"
  | "readonly"
  | "required"
  | "action"
  | "method"
  | "target"
  | "colspan"
  | "rowspan"
  | "width"
  | "height"
  | "autoplay"
  | "controls"
  | "loop"
  | "preload"
  | "muted"
  | "poster"
  | "selected"
  | "multiple"
  | "rows"
  | "cols"
  | "minlength"
  | "maxlength"
  | "pattern"
  | "min"
  | "max"
  | "step"
  | "hidden"
  | "contenteditable"
  | "draggable"
  | "spellcheck"
  | "tabindex"
  | "aria-label"
  | "aria-labelledby"
  | "innerText"
  | "textContent"
  | string;

//#endregion
