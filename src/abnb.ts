import { ExtractionReq, ExtractionRes } from "./interfaces";
import {
  ListingCalendarExtraction,
  ListingGalleryExtraction,
  ListingReviewExtraction,
} from "./types";
import { ElementToExtract } from "./enums";
import {
  getAvailalibity,
  getListing,
  getListings,
  getReviews,
  getUser,
  saveRemoteImagesToS3,
} from "./fn";
import { DateTime } from "luxon";
import { APIRequestContext, Browser } from "playwright-chromium";

export const abnbExtraction = async (
  browser: Browser,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  return new Promise(async (resolve, reject) => {
    let response: ExtractionRes;
    const page = await browser.newPage();
    const context = page.context();
    // page.on("request",(r)=>{
    //   let headers=r.headers();
    //   let key=headers["x-airbnb-api-key"]
    //   console.log(key)
    // })

    await page.goto(`https://www.airbnb.com/rooms/${req.sourceId}`,{
      timeout:60000
    });

     await page.waitForLoadState("networkidle");

     const api = context.request;
    try {
      switch (req.element) {
        case ElementToExtract.user:
          response = await abnbUser(api,req);
          break;
        case ElementToExtract.multipleListing:
          response = await abnbMultipleListing(api,req);
          break;
        case ElementToExtract.details:
          response = await abnbDetails(api,req);
          break;
        case ElementToExtract.reviews:
          response = await abnbReviews(api,req);
          break;
        case ElementToExtract.calendar:
          response = await abnbCalendar(api,req);
          break;
        case ElementToExtract.gallery:
          response = await abnbGallery(api,req);
          break;
        default:
          break;
      }

      resolve(response);
    } catch (err: any) {
      reject(err);
    }
  });
};

const abnbUser = async (api:APIRequestContext,req: ExtractionReq): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };
  let usr = await getUser(api,parseInt(req.sourceId));
  response.user = usr.user;
  return response;
};

const abnbMultipleListing = async (api:APIRequestContext,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };
  let units = await getListings(api,parseInt(req.sourceId), req.sourceCount);
  response.userListings = units.user_promo_listings;

  return response;
};

const abnbDetails = async (api:APIRequestContext,req: ExtractionReq): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };
  let unit = await getListing(api,parseInt(req.sourceId));

  response.details = {
    baths: unit.listing.bathrooms,
    bedrooms: unit.listing.bedrooms,
    beds: unit.listing.beds,
    costPerNight: unit.listing.price,
    maxOccupancy: unit.listing.person_capacity,
    description: unit.listing.description,
    title: unit.listing.name,
    reviews: unit.listing.reviews_count,
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

  return response;
};

const abnbReviews = async (api:APIRequestContext,req: ExtractionReq): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };

  let reviews = await getReviews(api,parseInt(req.sourceId), req.sourceCount);

  response.reviews = reviews.data.merlin.pdpReviews.reviews.map((review) => {
    let response: ListingReviewExtraction = {
      reviewId: review.id,
      rating: review.rating,
      date: DateTime.fromISO(review.createdAt).toJSDate(),
      author: review.reviewer.firstName,
      comment: review.comments,
      response: review.response,
    };
    return response;
  });

  return response;
};

const abnbCalendar = async (api:APIRequestContext,req: ExtractionReq): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };

  let dateStart = DateTime.now().setZone(process.env.timezone);
  let dateEnd = dateStart.plus({ months: req.sourceCount });
  let availability = await getAvailalibity(api,
    parseInt(req.sourceId),
    dateStart.toFormat("yyyy-MM-dd"),
    dateEnd.toFormat("yyyy-MM-dd")
  );

  response.calendar = availability.calendar.days.map((d) => {
    let r: ListingCalendarExtraction = {
      available: d.available,
      date: DateTime.fromFormat(d.date, "yyyy-MM-dd").toJSDate(),
    };
    return r;
  });

  return response;
};

const abnbGallery = async (api:APIRequestContext,req: ExtractionReq): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };

  let gallery = await saveRemoteImagesToS3(api,
    parseInt(req.sourceId),
    req.sourceData
  );

  response.gallery = gallery;

  return response;
};

// const abnbMultipleListing = async (
//   req: ExtractionReq
// ): Promise<ExtractionRes> => {
//   let response: ExtractionRes = {
//     extractionId: req.extractionId,
//     source: req.source,
//     sourceId: req.sourceId,
//     userId: req.userId,
//     Listings: [],
//   };
//   let selectedUser = await getUser(req.sourceId);

//   let listings = await getListings(
//     selectedUser.user.id,
//     selectedUser.user.listings_count
//   );

//   for (const u of listings.user_promo_listings) {
//     let unit = await getListing(u.id);
//     let reviews = await getReviews(u.id, unit.listing.reviews_count);
//     let gallery = await saveRemoteImagesToS3(unit.listing.photos);

//     let listing = new Listing();

//     listing.details = {
//       baths: unit.listing.bathrooms,
//       bedrooms: unit.listing.bedrooms,
//       beds: unit.listing.beds,
//       costPerNight: unit.listing.price,
//       maxOccupancy: unit.listing.person_capacity,
//       description: unit.listing.description,
//       title: unit.listing.name,
//     };

//     listing.reviews = reviews.data.merlin.pdpReviews.reviews.map((review) => {
//       let r: ListingReviewExtraction = {
//         reviewId: review.id,
//         rating: review.rating,
//         date: DateTime.fromISO(review.createdAt).toJSDate(),
//         author: review.reviewer.firstName,
//         comment: review.comments,
//         response: review.response,
//       };
//       return r;
//     });

//     listing.gallery = gallery;

//     response.Listings.push(listing);
//   }

//   return response;
// };
