import {
  AbnbSearchRequest,
  ExtractionReq,
  ExtractionRes,
  SearchQueryString,
  AbnbSearchResponse,
  SearchResponseInitialState,
  HostResponseInitialState,
  AbnbListingSectionsResponse,
  AbnbListingSectionOverview,
  AbnbListingSectionDescription,
  AbnbListingSectionLocation,
  AbnbListingSectionPhotoTour,
  AbnbListingSectionTitle,
  AbnbListingSectionCalendar,
  AbnbListingSectionReviews,
} from "./interfaces";
import {
  AbnbUser,
  ListingCalendarExtraction,
  ListingGalleryExtraction,
  ListingReviewExtraction,
  ListingSearchExtraction,
} from "./types";
import { ElementToExtract } from "./enums";
import {
  Abnb_getAvailalibity,
  Abnb_getListing,
  Abnb_getListings,
  Abnb_getListingSearch,
  Abnb_getReviews,
  Abnb_getHost,
  saveRemoteImagesToS3,
  Abnb_getPriceRanges,
  priceRangeLookup,
  HtmlLookup,
} from "./fn";
import { DateTime } from "luxon";
import { APIRequestContext, Browser, Page } from "playwright-chromium";

import fs from "fs";
import { ListingTemplate } from "./templates/ListingTemplate";

export const abnbExtraction = async (
  browser: Browser,
  req: ExtractionReq
  //dataSource:DataSource
): Promise<ExtractionRes> => {
  return new Promise(async (resolve, reject) => {
    let response: ExtractionRes;
    const page = await browser.newPage();
    const context = page.context();

    // Intercept network requests
    await context.route("**/*.{png,jpg,jpeg,gif}", (route) => {
      route.abort();
    });

    if (
      req.element === ElementToExtract.SEARCH ||
      req.element === ElementToExtract.PRICE_RANGE_LOOKUP
    ) {
      let coordinates: {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
      } | null = null;

      let bbox = req.sourceData.find((x) => x.key === "bbox");

      if (bbox !== undefined) {
        coordinates = JSON.parse(bbox.value);
      }
      if (req.element === ElementToExtract.PRICE_RANGE_LOOKUP) {
        await page.goto(
          `https://www.airbnb.com/s/Hello/homes?ne_lat=${coordinates.maxLng}&ne_lng=${coordinates.maxLat}&sw_lat=${coordinates.minLng}&sw_lng=${coordinates.minLat}`,
          {
            timeout: 60000,
          }
        );
      } else {
        let prices: { min: number; max: number; count: number } | null = null;

        let pricesData = req.sourceData.find((x) => x.key === "prices");
        if (pricesData !== undefined) {
          prices = JSON.parse(pricesData.value);

          await page.goto(
            `https://www.airbnb.com/s/Hello/homes?ne_lat=${coordinates.maxLat}&ne_lng=${coordinates.maxLng}&sw_lat=${coordinates.minLat}&sw_lng=${coordinates.minLng}&price_min=${prices.min}&price_max=${prices.max}`,
            {
              timeout: 60000,
            }
          );
        }
      }

      await page.waitForLoadState("networkidle");
    } else if (req.element === ElementToExtract.HOST) {
      await page.goto(`https://www.airbnb.com/users/show/${req.sourceId}`, {
        timeout: 60000,
      });
    } else {
      await page.goto(`https://www.airbnb.com/rooms/${req.sourceId}`, {
        timeout: 60000,
      });
    }

    const api = context.request;
    try {
      switch (req.element) {
        case ElementToExtract.PRICE_RANGE_LOOKUP:
          response = await abnbLookup(page, req);
          break;
        case ElementToExtract.HOST:
          response = await abnbUser(page, req);
          break;
        // case ElementToExtract.multipleListing:
        //   response = await abnbMultipleListing(api, req);
        //   break;
        case ElementToExtract.LISTING:
          response = await abnbDetails(page, req);
          break;
        case ElementToExtract.REVIEWS:
          response = await abnbReviews(api, req);
          break;
        case ElementToExtract.CALENDAR:
          response = await abnbCalendar(api, req);
          break;
        case ElementToExtract.GALLERY:
          response = await abnbGallery(api, req);
          break;
        case ElementToExtract.SEARCH:
          response = await abnbSearch(page, api, req);
          break;
        // case ElementToExtract.singleListing:
        //   response = await abnbSingleListing(api, req);
        //   break;
        default:
          break;
      }

      resolve(response);
    } catch (err: any) {
      reject(err);
    }
  });
};

const abnbLookup = async (
  page: Page,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: ElementToExtract.PRICE_RANGE_LOOKUP,
    companyId: req.companyId,
  };

  let coordinates: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null = null;

  let bbox = req.sourceData.find((x) => x.key === "bbox");

  if (bbox !== undefined) {
    coordinates = JSON.parse(bbox.value);
  }

  page.click('button[data-testid="category-bar-filter-button"]');

  await page.waitForLoadState("networkidle");

  let inputMin = await page.getAttribute("#price_filter_min", "value");

  let inputMax = await page.getAttribute("#price_filter_max", "value");

  if (inputMin !== null && inputMax !== null) {
    let ranges = await priceRangeLookup(
      parseInt(inputMin),
      parseInt(inputMax),
      page
    );

    response.lookup = {
      neLat: coordinates.maxLng,
      neLng: coordinates.maxLat,
      swLat: coordinates.minLng,
      swLng: coordinates.minLat,
      ranges: ranges,
    };
  }

  return response;
};

const abnbUser = async (
  page: Page,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
    companyId: req.companyId,
  };

  const dataStateText = await page.locator("#data-state").textContent();
  const dataStateJson = JSON.parse(dataStateText) as HostResponseInitialState;

  let rawUser = dataStateJson.niobeMinimalClientData.filter(
    (x) => x[0].indexOf("GetUserProfile") > -1
  )[0][1].data.presentation.userProfileContainer.userProfile;

  response.host = {
    id: rawUser.userId,
    firstName: rawUser.smartName,
    lastName: "",
    about: rawUser.about,
    listingsCount: rawUser.managedListings.length,
    totalListingsCount: rawUser.managedListingsTotalCount,
    pictureUrl: rawUser.profilePictureUrl.split("?")[0],
    thumbnailUrl: rawUser.profilePictureUrl.split("?")[0],
    createdAt: DateTime.fromISO(rawUser.createdAt).toJSDate(),
    revieweeCount: rawUser.reviewsReceivedFromGuests.count,
    isSuperhost: rawUser.isSuperhost,
  };

  return response;
};

const abnbMultipleListing = async (
  api: APIRequestContext,
  req: ExtractionReq
  //dataSource:DataSource
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
    companyId: req.companyId,
  };
  let listings = await Abnb_getListings(api, req.sourceId, req.sourceCount);
  response.userListings = listings;

  return response;
};

const abnbSingleListing = async (
  api: APIRequestContext,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
    companyId: req.companyId,
  };

  let unit = await Abnb_getListing(api, req.sourceId);
  let usr: AbnbUser;
  if (unit.listing !== undefined) {
    usr = await Abnb_getHost(api, unit.listing.primary_host.id.toString());
    response.host = {
      id: unit.listing.primary_host.id.toString(),
      firstName: unit.listing.primary_host.first_name,
      lastName: unit.listing.primary_host.last_name,
      about: usr.user.about,
      listingsCount: usr.user.listings_count,
      totalListingsCount: usr.user.total_listings_count,
      pictureUrl: unit.listing.primary_host.picture_url,
      thumbnailUrl: unit.listing.primary_host.thumbnail_url,
      createdAt: DateTime.fromISO(
        unit.listing.primary_host.created_at
      ).toJSDate(),
      revieweeCount: unit.listing.primary_host.reviewee_count,
      isSuperhost: unit.listing.primary_host.is_superhost,
    };

    let thumbnailImgName: string;
    if (unit.listing.thumbnail_url) {
      let imgArrayRaw = unit.listing.thumbnail_url.split("?");
      let imgOrigin = imgArrayRaw[0];

      let imgNameRaw = imgOrigin.split("/");

      thumbnailImgName = `${unit.listing.id}-${imgNameRaw[imgNameRaw.length - 1]
        .replace(".jpg", ".webp")
        .replace(".jpeg", ".webp")}`;
    }

    response.details = {
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
      type: unit.listing.property_type,
      roomType: unit.listing.room_type,
      thumbnail: thumbnailImgName,
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

    let reviews = await Abnb_getReviews(
      api,
      req.sourceId,
      unit.listing.reviews_count
    );

    let rev: ListingReviewExtraction[] = [];

    reviews.forEach((x) => {
      x.data.merlin.pdpReviews.reviews.map((review) => {
        let response: ListingReviewExtraction = {
          reviewId: review.id,
          rating: review.rating,
          date: DateTime.fromISO(review.createdAt).toJSDate(),
          author: review.reviewer.firstName,
          comment: review.comments,
          response: review.response,
        };
        rev.push(response);
      });
    });

    response.reviews = rev;

    let dateStart = DateTime.now().setZone(process.env.timezone);
    let dateEnd = dateStart.plus({ months: 12 });
    let availability = await Abnb_getAvailalibity(
      api,
      req.sourceId,
      dateStart.toFormat("yyyy-MM-dd"),
      dateEnd.toFormat("yyyy-MM-dd")
    );

    if (availability.calendar !== undefined) {
      response.calendar = availability.calendar.days.map((d) => {
        let r: ListingCalendarExtraction = {
          available: d.available,
          date: DateTime.fromFormat(d.date, "yyyy-MM-dd").toJSDate(),
        };
        return r;
      });
    } else {
      response.calendar = [];
    }

    let photos = unit.listing.photos.map((x) => {
      let response = {
        key: x.xl_picture,
        value: x.caption,
      };
      return response;
    });

    let gallery = await saveRemoteImagesToS3(api, req.sourceId, photos);

    response.gallery = gallery;
  }

  return response;
};

const abnbDetails = async (
  page: Page,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  return new Promise(async (resolve, _) => {
    let response: ExtractionRes = {
      extractionId: req.extractionId,
      source: req.source,
      sourceId: req.sourceId,
      userId: req.userId,
      element: req.element,
      companyId: req.companyId,
    };

    let source = await page
      .locator("div[data-section-id='BOOK_IT_SIDEBAR']")
      .textContent();

    let test = HtmlLookup(source, ListingTemplate);

    console.log(test);

    // const dataStateText = await page.locator("#data-state").textContent();
    // const dataStateJson = JSON.parse(dataStateText) as HostResponseInitialState;

    // fs.writeFile("test.json", dataStateText, { encoding: "utf-8" }, (err) => {
    //   console.log(err);
    // });
    // console.log(dataStateText);
    // let rawUser = dataStateJson.niobeMinimalClientData.filter(
    //   (x) => x[0].indexOf("GetUserProfile") > -1
    // )[0][1].data.presentation.userProfileContainer.userProfile;

    page.route("**", (route) => {
      let url = route.request().url();
      console.log("route", url);
      let method = route.request().method().toLowerCase();
      let modifiedBody = "";
      if (url.indexOf("https://www.airbnb.com/api/v3/StaysPdpSections") > -1) {
        let lookup = `%22sectionIds%22%3A%5B%22BOOK_IT_CALENDAR_SHEET%22%2C%22BOOK_IT_FLOATING_FOOTER%22%2C%22EDUCATION_FOOTER_BANNER_MODAL%22%2C%22POLICIES_DEFAULT%22%2C%22BOOK_IT_SIDEBAR%22%2C%22URGENCY_COMMITMENT_SIDEBAR%22%2C%22BOOK_IT_NAV%22%2C%22EDUCATION_FOOTER_BANNER%22%2C%22URGENCY_COMMITMENT%22%2C%22CANCELLATION_POLICY_PICKER_MODAL%22%5D`;
        let replaceString = `%22sectionIds%22%3A%5B%22BOOK_IT_CALENDAR_SHEET%22%2C%22BOOK_IT_FLOATING_FOOTER%22%2C%22EDUCATION_FOOTER_BANNER_MODAL%22%2C%22POLICIES_DEFAULT%22%2C%22BOOK_IT_SIDEBAR%22%2C%22URGENCY_COMMITMENT_SIDEBAR%22%2C%22BOOK_IT_NAV%22%2C%22EDUCATION_FOOTER_BANNER%22%2C%22URGENCY_COMMITMENT%22%2C%22CANCELLATION_POLICY_PICKER_MODAL%22%2C%22OVERVIEW_DEFAULT%22%2C%22TITLE_DEFAULT%22%2C%22DESCRIPTION_DEFAULT%22%2C%22PHOTO_TOUR_SCROLLABLE_MODAL%22%2C%22LOCATION_DEFAULT%22%2C%22AVAILABILITY_CALENDAR_DEFAULT%22%2C%22REVIEWS_DEFAULT%22%5D`;

        let newUrl = url.replace(lookup, replaceString);
        console.log("newUrl", newUrl);

        route.continue({ url: newUrl });
      }
    });

    page.on("response", (r) => {
      let url = r.url();

      if (
        url.trim().indexOf("https://www.airbnb.com/api/v3/StaysPdpSections") >
        -1
      ) {
        console.log("url", url.trim());
        r.body().then(async (b) => {
          let sections = JSON.parse(
            b.toString()
          ) as AbnbListingSectionsResponse;

          //console.log(sections.data.presentation.stayProductDetailPage.sections.sections)

          const overview =
            sections.data.presentation.stayProductDetailPage.sections.sections.find(
              (x) => x.sectionId === "OVERVIEW_DEFAULT"
            );

          const title =
            sections.data.presentation.stayProductDetailPage.sections.sections.find(
              (x) => x.sectionId === "TITLE_DEFAULT"
            );

          const description =
            sections.data.presentation.stayProductDetailPage.sections.sections.find(
              (x) => x.sectionId === "DESCRIPTION_DEFAULT"
            );
          const photos =
            sections.data.presentation.stayProductDetailPage.sections.sections.find(
              (x) => x.sectionId === "PHOTO_TOUR_SCROLLABLE_MODAL"
            );
          const location =
            sections.data.presentation.stayProductDetailPage.sections.sections.find(
              (x) => x.sectionId === "LOCATION_DEFAULT"
            );

          const calendar =
            sections.data.presentation.stayProductDetailPage.sections.sections.find(
              (x) => x.sectionId === "AVAILABILITY_CALENDAR_DEFAULT"
            );

          const reviews =
            sections.data.presentation.stayProductDetailPage.sections.sections.find(
              (x) => x.sectionId === "REVIEWS_DEFAULT"
            );

          console.log(overview);
          console.log(description);
          console.log(photos);
          console.log(location);
          console.log(calendar);
          console.log(title);
          console.log(reviews);

          if (
            overview !== undefined &&
            description !== undefined &&
            photos !== undefined &&
            location !== undefined &&
            calendar !== undefined &&
            title !== undefined &&
            reviews !== undefined
          ) {
            let oSectionGuests = (
              overview.section as AbnbListingSectionOverview
            ).detailItems.find((x) => x.title.indexOf("guest") > -1);
            let oSectionBedrooms = (
              overview.section as AbnbListingSectionOverview
            ).detailItems.find((x) => x.title.indexOf("bedrooms") > -1);
            let oSectionBeds = (
              overview.section as AbnbListingSectionOverview
            ).detailItems.find((x) => x.title.indexOf("beds") > -1);
            let oSectionBaths = (
              overview.section as AbnbListingSectionOverview
            ).detailItems.find((x) => x.title.indexOf("bath") > -1);
            let guests = 0;
            let bedrooms = 0;
            let beds = 0;
            let baths = 0;
            if (oSectionGuests !== undefined) {
              guests = parseInt(oSectionGuests.title.split(" ")[0]);
            }
            if (oSectionBedrooms !== undefined) {
              bedrooms = parseInt(oSectionBedrooms.title.split(" ")[0]);
            }
            if (oSectionBeds !== undefined) {
              beds = parseInt(oSectionBeds.title.split(" ")[0]);
            }
            if (oSectionBaths !== undefined) {
              baths = parseInt(oSectionBaths.title.split(" ")[0]);
            }

            let dSectionDescription = (
              description.section as AbnbListingSectionDescription
            ).htmlDescription.htmlText;

            let tSectionTitle = (title.section as AbnbListingSectionTitle)
              .title;

            let lSectionLocation =
              location.section as AbnbListingSectionLocation;

            let pSectionPhotos = (photos.section as AbnbListingSectionPhotoTour)
              .mediaItems;

            let cSectionCalendar =
              calendar.section as AbnbListingSectionCalendar;

            let rSectionReviews = reviews.section as AbnbListingSectionReviews;

            // let selectedRoom = rawUser.managedListings.find(
            //   (x) => x.id === req.sourceId
            // );
            // if (selectedRoom !== undefined) {
            response.details = {
              baths: baths,
              bedrooms: bedrooms,
              beds: beds,
              costPerNight: 0, //parseInt(test["price"]),
              maxOccupancy: guests,
              description: dSectionDescription,
              title: tSectionTitle,
              reviews: rSectionReviews.overallCount,
              lat: lSectionLocation.lat,
              lng: lSectionLocation.lng,
              thumbnail: cSectionCalendar.thumbnail.baseUrl.split("?")[0],
              photos: pSectionPhotos.map((x) => {
                let response: ListingGalleryExtraction = {
                  imageId: x.id.toString(),
                  origin: x.baseUrl,
                  objectKey: "",
                  caption: x.caption,
                };
                return response;
              }),
            };
            //}

            resolve(response);
          }
        });
      }
    });
  });
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
    companyId: req.companyId,
  };

  let unit = await Abnb_getListing(api, req.sourceId);

  if (unit !== null) {
    let reviews = await Abnb_getReviews(
      api,
      req.sourceId,
      unit.listing.reviews_count
    );

    let rev: ListingReviewExtraction[] = [];
    reviews.forEach((x) => {
      x.data.merlin.pdpReviews.reviews.forEach((review) => {
        let response: ListingReviewExtraction = {
          reviewId: review.id,
          rating: review.rating,
          date: DateTime.fromISO(review.createdAt).toJSDate(),
          author: review.reviewer.firstName,
          comment: review.comments,
          response: review.response,
        };
        rev.push(response);
      });
    });

    response.reviews = rev;
  }

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
    companyId: req.companyId,
  };

  let dateStart = DateTime.now().setZone(process.env.timezone);
  let unit = await Abnb_getListing(api, req.sourceId);
  if (unit !== null) {
    let dateEnd = dateStart.plus({ days: unit.listing.max_nights_input_value });
    let availability = await Abnb_getAvailalibity(
      api,
      req.sourceId,
      dateStart.toFormat("yyyy-MM-dd"),
      dateEnd.toFormat("yyyy-MM-dd")
    );

    if (availability.calendar !== undefined) {
      response.calendar = availability.calendar.days.map((d) => {
        let r: ListingCalendarExtraction = {
          available: d.available,
          date: DateTime.fromFormat(d.date, "yyyy-MM-dd").toJSDate(),
        };
        return r;
      });
    } else {
      response.calendar = [];
    }
  }

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
    companyId: req.companyId,
  };

  let unit = await Abnb_getListing(api, req.sourceId);

  if (unit !== null) {
    let items = unit.listing.photos.map((x) => {
      return {
        key: x.xl_picture,
        value: x.caption,
      };
    });
    let gallery = await saveRemoteImagesToS3(api, req.sourceId, items);

    response.gallery = gallery;
  }

  return response;
};

const abnbSearch = async (
  page: Page,
  api: APIRequestContext,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  return new Promise(async (resolve, reject) => {
    let response: ExtractionRes = {
      extractionId: req.extractionId,
      source: req.source,
      sourceId: req.sourceId,
      userId: req.userId,
      element: req.element,
      companyId: req.companyId,
    };
    let prices: {
      min: number;
      max: number;
      count: number;
    } | null = null;
    let pricesData = req.sourceData.find((x) => x.key === "prices");
    if (pricesData !== undefined) {
      prices = JSON.parse(pricesData.value);
    }
    let listings: ListingSearchExtraction[] = [];
    const totalPages = Math.ceil(prices.count / 18);
    const nextBtnSelector = "a[aria-label='Next']";
    const nextBtn = page.locator(nextBtnSelector).nth(0);

    const deferredStateText = await page
      .locator("#data-deferred-state")
      .textContent();
    const deferredStateJson = JSON.parse(
      deferredStateText
    ) as SearchResponseInitialState;

    let initialSearchData: ListingSearchExtraction[] =
      deferredStateJson.niobeMinimalClientData[0][1].data.presentation.explore.sections.sectionIndependentData.staysSearch.searchResults
        .map((x) => {
          let item: ListingSearchExtraction | null = null;
          if (x.listing !== undefined) {
            item = {
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
          }
          return item;
        })
        .filter((x) => x !== null);

    listings.push(...initialSearchData);
    if (nextBtn) {
      let currentPage = 1;
      while (currentPage < totalPages) {
        await nextBtn.click();

        page.on("response", (r) => {
          let url = r.url();
          if (
            url.trim().indexOf("https://www.airbnb.com/api/v3/StaysSearch") > -1
          ) {
            r.body().then(async (b) => {
              let search = JSON.parse(b.toString()) as AbnbSearchResponse;
              //console.log(JSON.stringify(search));
              let data =
                search.data.presentation.explore.sections.sectionIndependentData.staysSearch.searchResults
                  .map((x) => {
                    let item: ListingSearchExtraction | null = null;
                    if (x.listing !== undefined) {
                      item = {
                        isNew:
                          x.listing.avgRatingLocalized === null
                            ? false
                            : x.listing.avgRatingLocalized.toLowerCase() ===
                              "new"
                            ? true
                            : false,
                        avgRating:
                          x.listing.avgRatingLocalized === null
                            ? 0
                            : x.listing.avgRatingLocalized.toLowerCase() ===
                              "new"
                            ? 0
                            : parseFloat(
                                x.listing.avgRatingLocalized.split(" ")[0]
                              ),
                        coordinate: {
                          latitude: x.listing.coordinate.latitude,
                          longitude: x.listing.coordinate.longitude,
                        },
                        id: x.listing.id,
                        name: x.listing.name,
                        price:
                          x.pricingQuote.structuredStayDisplayPrice.primaryLine
                            .price === undefined
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
                    }

                    return item;
                  })
                  .filter((x) => x !== null);
              listings.push(...data);
              currentPage++;
            });
          }
        });
      }

      response.search = listings;
      resolve(response);
    }
  });
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
  page: Page,
  sourceData: {
    key: string;
    value: string;
  }[]
): Promise<{
  success: boolean;
  hash: string;
  query: string[];
  cursors: string[];
  priceMin: string;
  priceMax: string;
  neLat: string;
  neLng: string;
  swLat: string;
  swLng: string;
}> => {
  return new Promise(async (resolve, reject) => {
    let h: string = "";
    let p: string = "";
    let q: string[] = [];

    let coordinates: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    } | null = null;

    let prices: {
      min: number;
      max: number;
      count: number;
    } | null = null;

    let bbox = sourceData.find((x) => x.key === "bbox");
    let pricesData = sourceData.find((x) => x.key === "prices");
    if (bbox !== undefined) {
      coordinates = JSON.parse(bbox.value);
    }

    if (pricesData !== undefined) {
      prices = JSON.parse(pricesData.value);
    }

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
          let obj = JSON.parse(b.toString()) as AbnbSearchResponse;

          resolve({
            success: true,
            hash: h,
            query: q,
            cursors:
              obj.data.presentation.explore.sections.sectionIndependentData
                .staysSearch.paginationInfo.pageCursors,
            swLat: `${coordinates.minLat}`,
            swLng: `${coordinates.minLng}`,
            neLat: `${coordinates.maxLat}`,
            neLng: `${coordinates.maxLng}`,
            priceMin: `${prices.min}`,
            priceMax: `${prices.max}`,
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
    priceMin: string;
    priceMax: string;
    neLat: string;
    neLng: string;
    swLat: string;
    swLng: string;
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
          // isInitialLoad: true,
          // hasLoggedIn: false,
          // cdnCacheSafe: false,
          // source: "EXPLORE",
          staysMapSearchRequestV2: {
            requestedPageType: "STAYS_SEARCH",
            cursor: currentCursor,
            metadataOnly: false,
            searchType: "unknown",
            treatmentFlags: [
              "decompose_stays_search_m2_treatment",
              "decompose_stays_search_m3_treatment",
              "decompose_stays_search_m3_5_treatment",
              "flex_destinations_june_2021_launch_web_treatment",
              "new_filter_bar_v2_fm_header",
              "flexible_dates_12_month_lead_time",
              "lazy_load_flex_search_map_compact",
              "lazy_load_flex_search_map_wide",
              "im_flexible_may_2022_treatment",
              "search_add_category_bar_ui_ranking_web",
              "feed_map_decouple_m11_treatment",
              "flexible_dates_options_extend_one_three_seven_days",
              "super_date_flexibility",
              "micro_flex_improvements",
              "micro_flex_show_by_default",
              "search_input_placeholder_phrases",
              "pets_fee_treatment",
            ],
            rawParams: [
              { filterName: "cdnCacheSafe", filterValues: ["false"] },
              { filterName: "channel", filterValues: ["EXPLORE"] },
              {
                filterName: "federatedSearchSessionId",
                filterValues: [sessionId],
              },
              { filterName: "flexibleTripLengths", filterValues: ["one_week"] },
              { filterName: "itemsPerGrid", filterValues: ["18"] },
              { filterName: "monthlyLength", filterValues: ["3"] },
              { filterName: "monthlyStartDate", filterValues: ["2023-08-01"] },
              {
                filterName: "neLat",
                filterValues: [data.neLat],
              },
              {
                filterName: "neLng",
                filterValues: [data.neLng],
              },
              { filterName: "priceFilterInputType", filterValues: ["0"] },
              { filterName: "priceFilterNumNights", filterValues: ["5"] },
              {
                filterName: "priceMax",
                filterValues: [data.priceMax],
              },
              {
                filterName: "priceMin",
                filterValues: [data.priceMin],
              },
              { filterName: "query", filterValues: data.query },
              { filterName: "refinementPaths", filterValues: ["/homes"] },
              { filterName: "screenSize", filterValues: ["large"] },
              {
                filterName: "swLat",
                filterValues: [data.swLat],
              },
              {
                filterName: "swLng",
                filterValues: [data.swLng],
              },
              { filterName: "tabId", filterValues: ["home_tab"] },
              { filterName: "version", filterValues: ["1.8.3"] },
            ],
          },
          staysSearchRequest: {
            requestedPageType: "STAYS_SEARCH",
            cursor: currentCursor,
            metadataOnly: false,
            searchType: "unknown",
            treatmentFlags: [
              "decompose_stays_search_m2_treatment",
              "decompose_stays_search_m3_treatment",
              "decompose_stays_search_m3_5_treatment",
              "flex_destinations_june_2021_launch_web_treatment",
              "new_filter_bar_v2_fm_header",
              "flexible_dates_12_month_lead_time",
              "lazy_load_flex_search_map_compact",
              "lazy_load_flex_search_map_wide",
              "im_flexible_may_2022_treatment",
              "search_add_category_bar_ui_ranking_web",
              "feed_map_decouple_m11_treatment",
              "flexible_dates_options_extend_one_three_seven_days",
              "super_date_flexibility",
              "micro_flex_improvements",
              "micro_flex_show_by_default",
              "search_input_placeholder_phrases",
              "pets_fee_treatment",
            ],
            rawParams: [
              { filterName: "cdnCacheSafe", filterValues: ["false"] },
              { filterName: "channel", filterValues: ["EXPLORE"] },
              {
                filterName: "federatedSearchSessionId",
                filterValues: [sessionId],
              },
              { filterName: "flexibleTripLengths", filterValues: ["one_week"] },
              { filterName: "itemsPerGrid", filterValues: ["18"] },
              { filterName: "monthlyLength", filterValues: ["3"] },
              { filterName: "monthlyStartDate", filterValues: ["2023-08-01"] },
              {
                filterName: "neLat",
                filterValues: [data.neLat],
              },
              {
                filterName: "neLng",
                filterValues: [data.neLng],
              },
              { filterName: "priceFilterInputType", filterValues: ["0"] },
              { filterName: "priceFilterNumNights", filterValues: ["5"] },
              {
                filterName: "priceMax",
                filterValues: [data.priceMax],
              },
              {
                filterName: "priceMin",
                filterValues: [data.priceMin],
              },
              { filterName: "query", filterValues: data.query },
              { filterName: "refinementPaths", filterValues: ["/homes"] },
              { filterName: "screenSize", filterValues: ["large"] },
              {
                filterName: "swLat",
                filterValues: [data.swLat],
              },
              {
                filterName: "swLng",
                filterValues: [data.swLng],
              },
              { filterName: "tabId", filterValues: ["home_tab"] },
              { filterName: "version", filterValues: ["1.8.3"] },
            ],
          },
          decomposeCleanupEnabled: false,
          decomposeFiltersEnabled: false,
          feedMapDecoupleEnabled: true,
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: data.hash,
          },
        },
      };
      let pageResults = await Abnb_getListingSearch(api, newRequest);
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
//   let selectedUser = await Abnb_getHost(req.sourceId);

//   let listings = await Abnb_getListings(
//     selectedUser.user.id,
//     selectedUser.user.listings_count
//   );

//   for (const u of listings.user_promo_listings) {
//     let unit = await Abnb_getListing(u.id);
//     let reviews = await Abnb_getReviews(u.id, unit.listing.reviews_count);
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

//https://a0.muscache.com/pictures/e8fdac52-bf22-49a2-b73d-74d5ed6a3222.jpg
//https://a0.muscache.com/pictures/e8fdac52-bf22-49a2-b73d-74d5ed6a3222.jpg
