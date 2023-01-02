import {
  AbnbSearchRequest,
  ExtractionReq,
  ExtractionRes,
  SearchQueryString,
  SearchResponse,
} from "./interfaces";
import {
  ListingCalendarExtraction,
  ListingGalleryExtraction,
  ListingReviewExtraction,
  ListingSearchExtraction,
} from "./types";
import { ElementToExtract } from "./enums";
import {
  getAvailalibity,
  getListing,
  getListings,
  getListingSearch,
  getReviews,
  getUser,
  saveRemoteImagesToS3,
} from "./fn";
import { DateTime } from "luxon";
import { APIRequestContext, Browser, Page } from "playwright-chromium";

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

    if (req.element !== ElementToExtract.search) {
      await page.goto(`https://www.airbnb.com/rooms/${req.sourceId}`, {
        timeout: 60000,
      });
    } else {
      await page.goto(`https://www.airbnb.com/s/${req.sourceId}/homes`, {
        timeout: 60000,
      });
    }

    await page.waitForLoadState("networkidle");

    const api = context.request;
    try {
      switch (req.element) {
        case ElementToExtract.user:
          response = await abnbUser(api, req);
          break;
        case ElementToExtract.multipleListing:
          response = await abnbMultipleListing(api, req);
          break;
        case ElementToExtract.details:
          response = await abnbDetails(api, req);
          break;
        case ElementToExtract.reviews:
          response = await abnbReviews(api, req);
          break;
        case ElementToExtract.calendar:
          response = await abnbCalendar(api, req);
          break;
        case ElementToExtract.gallery:
          response = await abnbGallery(api, req);
          break;
        case ElementToExtract.search:
          response = await abnbSearch(page, api, req);
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

const abnbUser = async (
  api: APIRequestContext,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };
  let usr = await getUser(api, parseInt(req.sourceId));
  response.user = usr.user;
  return response;
};

const abnbMultipleListing = async (
  api: APIRequestContext,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };
  let units = await getListings(api, parseInt(req.sourceId), req.sourceCount);
  response.userListings = units.user_promo_listings;

  return response;
};

const abnbDetails = async (
  api: APIRequestContext,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };
  let unit = await getListing(api, parseInt(req.sourceId));

  response.host = {
    id:unit.listing.primary_host.id.toString(),
    firstName: unit.listing.primary_host.first_name,
    lastName: unit.listing.primary_host.last_name,
    pictureUrl: unit.listing.primary_host.picture_url,
    thumbnailUrl: unit.listing.primary_host.thumbnail_url,
    createdAt: DateTime.fromISO(
      unit.listing.primary_host.created_at
    ).toJSDate(),
    revieweeCount: unit.listing.primary_host.reviewee_count,
    isSuperhost: unit.listing.primary_host.is_superhost,
  };

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

const abnbReviews = async (
  api: APIRequestContext,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };

  let reviews = await getReviews(api, parseInt(req.sourceId), req.sourceCount);

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

const abnbCalendar = async (
  api: APIRequestContext,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };

  let dateStart = DateTime.now().setZone(process.env.timezone);
  let dateEnd = dateStart.plus({ months: req.sourceCount });
  let availability = await getAvailalibity(
    api,
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

const abnbGallery = async (
  api: APIRequestContext,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };

  let gallery = await saveRemoteImagesToS3(
    api,
    parseInt(req.sourceId),
    req.sourceData
  );

  response.gallery = gallery;

  return response;
};

const abnbSearch = async (
  page: Page,
  api: APIRequestContext,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
  };

  const starterBtnSelector = "a[aria-label='Next']";
  const starterBtn = page.locator(starterBtnSelector).nth(0);

  if (starterBtn) {
    let href = await starterBtn.getAttribute("href");
    let queryString = href.split("?")[1];
    const urlParams = new URLSearchParams(queryString);
    const entries = urlParams.entries();
    const params = paramsToObject(entries);

    let sha256HashAndCursors = await getSha256HashAndCursors(page);

    let searchResult = await getSearch(
      api,
      params.federated_search_session_id,
      sha256HashAndCursors
    );

    response.search = searchResult;
  }

  return response;
};

const paramsToObject = (entries: IterableIterator<[string, string]>) => {
  const result: SearchQueryString = {
    tab_id: "",
    query: "",
    place_id: "",
    price_filter_input_type: "",
    price_filter_num_nights: "",
    federated_search_session_id: "",
    search_type: "",
    pagination_search: "",
    cursor: "",
  };
  for (const [key, value] of entries) {
    // each 'entry' is a [key, value] tupple
    result[key] = value;
  }
  return result;
};

const abnbSearchRequestResultPage = async (page: Page) => {
  const starterBtnSelector = "a[aria-label='Next']";
  const starterBtn = page.locator(starterBtnSelector);
  if (starterBtn) {
    await starterBtn.click();
  } else {
    return false;
  }
};

const getSha256HashAndCursors = (
  page: Page
): Promise<{
  success: boolean;
  hash: string;
  placeId: string;
  query: string[];
  cursors: string[];
}> => {
  return new Promise(async (resolve, reject) => {
    let h: string = "";
    let p: string = "";
    let q: string[] = [];
    page.route("**", (route) => {
      let url = route.request().url();
      let method = route.request().method().toLowerCase();
      let modifiedBody = "";
      if (
        url.indexOf("https://www.airbnb.com/api/v3/StaysSearch") > -1 &&
        method === "post"
      ) {
        let obj = JSON.parse(route.request().postData()) as AbnbSearchRequest;
        h = obj.extensions.persistedQuery.sha256Hash;
        let objQuery = obj.variables.staysSearchRequest.rawParams.find(
          (x) => x.filterName === "query"
        );
        if (objQuery !== undefined) {
          q = objQuery.filterValues;
        }

        let objPlaceId = obj.variables.staysSearchRequest.rawParams.find(
          (x) => x.filterName === "placeId"
        );
        if (objPlaceId !== undefined) {
          p = objPlaceId.filterValues[0];
        }

        obj.variables.staysSearchRequest.rawParams =
          obj.variables.staysSearchRequest.rawParams.map((x) => {
            if (x.filterName === "itemsPerGrid") {
              x.filterValues = ["40"];
            }
            return x;
          });

        modifiedBody = JSON.stringify(obj);
      }
      return modifiedBody === ""
        ? route.continue()
        : route.continue({ postData: modifiedBody });
    });

    page.on("response", (r) => {
      let url = r.url();
      if (
        url.trim().indexOf("https://www.airbnb.com/api/v3/StaysSearch") > -1
      ) {
        r.body().then(async (b) => {
          let obj = JSON.parse(b.toString()) as SearchResponse;

          resolve({
            success: true,
            hash: h,
            placeId: p,
            query: q,
            cursors:
              obj.data.presentation.explore.sections.sectionIndependentData
                .staysSearch.paginationInfo.pageCursors,
          });
        });
      }
    });

    let response = await abnbSearchRequestResultPage(page);

    if (response === false) {
      reject({ success: false, hash: "", placeId: "", query: [], cursors: [] });
    }
  });
};

const getSearch = (
  api: APIRequestContext,
  sessionId: string,
  data: {
    success: boolean;
    hash: string;
    placeId: string;
    query: string[];
    cursors: string[];
  }
): Promise<ListingSearchExtraction[]> => {
  return new Promise(async (resolve, reject) => {
    let results: ListingSearchExtraction[] = [];
    for (const [index, currentCursor] of data.cursors.entries()) {
      let newRequest: AbnbSearchRequest = {
        operationName: "StaysSearch",
        variables: {
          isInitialLoad: true,
          hasLoggedIn: false,
          cdnCacheSafe: false,
          source: "EXPLORE",
          staysSearchRequest: {
            requestedPageType: "STAYS_SEARCH",
            cursor: currentCursor,
            metadataOnly: false,
            searchType: "unknown",
            treatmentFlags: [
              "decompose_stays_search_m2_treatment",
              "flex_destinations_june_2021_launch_web_treatment",
              "new_filter_bar_v2_fm_header",
              "new_filter_bar_v2_and_fm_treatment",
              "merch_header_breakpoint_expansion_web",
              "flexible_dates_12_month_lead_time",
              "storefronts_nov23_2021_homepage_web_treatment",
              "lazy_load_flex_search_map_compact",
              "lazy_load_flex_search_map_wide",
              "im_flexible_may_2022_treatment",
              "im_flexible_may_2022_treatment",
              "flex_v2_review_counts_treatment",
              "search_add_category_bar_ui_ranking_web",
              "p2_grid_updates_web_v2",
              "flexible_dates_options_extend_one_three_seven_days",
              "super_date_flexibility",
              "micro_flex_improvements",
              "micro_flex_show_by_default",
              "search_input_placeholder_phrases",
              "pets_fee_treatment",
            ],
            rawParams: [
              { filterName: "cdnCacheSafe", filterValues: ["false"] },
              {
                filterName: "federatedSearchSessionId",
                filterValues: [sessionId],
              },
              { filterName: "flexibleTripLengths", filterValues: ["one_week"] },
              { filterName: "hasLoggedIn", filterValues: ["false"] },
              { filterName: "isInitialLoad", filterValues: ["true"] },
              { filterName: "itemsPerGrid", filterValues: ["40"] },
              {
                filterName: "placeId",
                filterValues: [data.placeId],
              },
              { filterName: "priceFilterInputType", filterValues: ["0"] },
              { filterName: "priceFilterNumNights", filterValues: ["5"] },
              { filterName: "query", filterValues: data.query },
              { filterName: "refinementPaths", filterValues: ["/homes"] },
              { filterName: "screenSize", filterValues: ["large"] },
              { filterName: "tabId", filterValues: ["home_tab"] },
              { filterName: "version", filterValues: ["1.8.3"] },
            ],
          },
          staysSearchM3Enabled: false,
          staysSearchM6Enabled: false,
          feedMapDecoupleEnabled: false,
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: data.hash,
          },
        },
      };
      let pageResults = await getListingSearch(api, newRequest);
      if (pageResults.length > 0) {
        results.push.apply(results, pageResults);
      }
    }

    const map = new Map(results.map((obj) => [obj.id, obj]));
    const deduplicatedResults = [...map.values()];

    resolve(deduplicatedResults);
  });
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
