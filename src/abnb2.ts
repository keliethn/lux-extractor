import { Browser, Page } from "playwright-core";
import {
  AbnbSearchResponse,
  ExtractionReq,
  ExtractionRes,
  HostResponseInitialState,
  ListingsBbox,
  ListingsPrice,
  SearchResponseInitialState,
} from "./interfaces";
import { ElementToExtract } from "./enums";
import { DateTime } from "luxon";
import { HtmlLookup, saveRemoteImagesToS3V2 } from "./fn";
import { ListingTemplate } from "./templates/ListingTemplate";
import fs from "fs";
import {
  ListingGalleryExtraction,
  ListingReviewExtraction,
  ListingSearchExtraction,
  Review,
} from "./types";

export const abnbExtraction = async (
  browser: Browser,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  return new Promise(async (resolve, reject) => {
    try {
      let response: ExtractionRes;
      const page = await browser.newPage();
      await browseToRequiredPage(req, page);
     
      const pageTitle = await page.title();

      if(pageTitle.toLowerCase().indexOf("not found")>-1){
        reject("not found")
      }

      response = await executeSegmentExtraction(req, page);
      resolve(response);
    } catch (err) {
      reject(err);
    }
  });
};

const browseToRequiredPage = async (req: ExtractionReq, page: Page) => {
  const homepageUrl = 'https://airbnb.com';
  if (req.element === ElementToExtract.SEARCH) {
    let coordinatesSearch: ListingsBbox | null = null;
    let bboxSearch = req.sourceData.find((x) => x.key === "bbox");

    let pricesSearch: ListingsPrice | null = null;
    let pricesSearchData = req.sourceData.find((x) => x.key === "prices");

    if (bboxSearch !== undefined) {
      coordinatesSearch = JSON.parse(bboxSearch.value);

      if (pricesSearchData !== undefined) {
        pricesSearch = JSON.parse(pricesSearchData.value);

        await page.goto(
          `https://www.airbnb.com/s/Hello/homes?ne_lat=${coordinatesSearch.maxLat}&ne_lng=${coordinatesSearch.maxLng}&sw_lat=${coordinatesSearch.minLat}&sw_lng=${coordinatesSearch.minLng}&price_min=${pricesSearch.min}&price_max=${pricesSearch.max}`,
          {
            timeout: 60000,
          }
        );
      }
    }
  } else if (req.element === ElementToExtract.PRICE_RANGE_LOOKUP) {
    let coordinatesLookup: ListingsBbox | null = null;
    let bboxLookup = req.sourceData.find((x) => x.key === "bbox");
    if (bboxLookup !== undefined) {
      coordinatesLookup = JSON.parse(bboxLookup.value);
      await page.goto(
        `https://www.airbnb.com/s/Hello/homes?ne_lat=${coordinatesLookup.maxLat}&ne_lng=${coordinatesLookup.maxLng}&sw_lat=${coordinatesLookup.minLat}&sw_lng=${coordinatesLookup.minLng}`,
        {
          timeout: 60000,
        }
      );
    }
  } else if (req.element === ElementToExtract.HOST) {
    await page.goto(`https://www.airbnb.com/users/show/${req.sourceId}`, {
      timeout: 60000,
    });
  } else {
    await page.goto(`https://www.airbnb.com/rooms/${req.sourceId}`, {
      timeout: 60000,
    });
  }
};

const executeSegmentExtraction = (
  req: ExtractionReq,
  page: Page
): Promise<ExtractionRes> => {
  return new Promise(async (resolve, reject) => {
    let response: ExtractionRes;
    try {
      switch (req.element) {
        case ElementToExtract.PRICE_RANGE_LOOKUP:
          response = await abnbLookup(page, req);
          break;
        case ElementToExtract.HOST:
          response = await abnbHost(page, req);
          break;
        case ElementToExtract.LISTING:
          response = await abnbListing(page, req);
          break;
        case ElementToExtract.REVIEWS:
          response = await abnbReviews(page, req);
          break;
        case ElementToExtract.CALENDAR:
          response = await abnbCalendar(page, req);
          break;
        case ElementToExtract.GALLERY:
          response = await abnbGallery(page, req);
          break;
        case ElementToExtract.SEARCH:
          response = await abnbSearch(page, req);
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

  let coordinates: ListingsBbox | null = null;

  let bbox = req.sourceData.find((x) => x.key === "bbox");

  if (bbox !== undefined) {
    coordinates = JSON.parse(bbox.value);
  }

  //Click filter button
  page.click('button[data-testid="category-bar-filter-button"]');

  //Await for network idle
  await page.waitForLoadState("networkidle");

  //Get min value
  let inputMin = await page.getAttribute("#price_filter_min", "value");

  //Get max value
  let inputMax = await page.getAttribute("#price_filter_max", "value");

  if (inputMin !== null && inputMax !== null) {
    let rangesInAndOutScale: {
      min: number;
      max: number;
      count: number;
    }[] = [];

    let rangesInScale = await priceRangeLookupInsideScale(
      parseInt(inputMin),
      parseInt(inputMax),
      page
    );

    // let rangesOutScale = await priceRangeLookupOutsideScale(
    //   parseInt(inputMax),
    //   page
    // );

    // if (rangesOutScale.length > 0) {
    //   rangesInAndOutScale.push(...rangesOutScale);
    // }

    if (rangesInScale.length > 0) {
      rangesInAndOutScale.push(...rangesInScale);
    }

    response.lookup = {
      neLat: coordinates.maxLat,
      neLng: coordinates.maxLng,
      swLat: coordinates.minLat,
      swLng: coordinates.minLng,
      ranges: rangesInAndOutScale,
    };

  }

  return response;
};

const abnbHost = async (
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

const abnbListing = async (
  page: Page,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: ElementToExtract.LISTING,
    companyId: req.companyId,
  };
  await page.waitForLoadState("networkidle");
  const button = page.locator('div[data-section-id="OVERVIEW_DEFAULT"] button');
  await button.click();
  await page.waitForSelector("div[data-section-id='HOST_PROFILE_DEFAULT'] a");

  let source = await page.content();
  let data = HtmlLookup(source, ListingTemplate);

  response.details = {
    baths: data.baths,
    bedrooms: data.bedrooms,
    beds: data.beds,
    costPerNight: data.costPerNight,
    maxOccupancy: data.maxOccupancy,
    description: data.description,
    title: data.title,
    reviews: data.totalReviews,
    hostId:data.hostId,
    thumbnail: data.thumbnail,
  };

  //console.log(data);

  return response;
};

const abnbReviews = async (
  page: Page,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  return new Promise(async (resolve, reject) => {
    let response: ExtractionRes = {
      extractionId: req.extractionId,
      source: req.source,
      sourceId: req.sourceId,
      userId: req.userId,
      element: ElementToExtract.REVIEWS,
      companyId: req.companyId,
    };

    await page.waitForLoadState("networkidle");

    page.on("response", (r) => {
      let url = r.url();
      if (url.trim().indexOf("https://www.airbnb.com/api/v3/PdpReviews") > -1) {
        r.body().then(async (b) => {
          let reviewsObject = JSON.parse(b.toString());
          let rawReviews = reviewsObject.data.merlin.pdpReviews
            .reviews as Review[];

          for (const rev of rawReviews) {
            if (reviews.find((x) => x.reviewId === rev.id) === undefined) {
              let resp: ListingReviewExtraction = {
                reviewId: rev.id,
                rating: rev.rating,
                date: DateTime.fromISO(rev.createdAt).toJSDate(),
                author: rev.reviewer.firstName,
                comment: rev.comments,
                response: rev.response === null ? undefined : rev.response,
              };
              reviews.push(resp);
            }
          }

          if (reviews.length === totalReviews) {
            response.reviews = reviews;
            resolve(response);
          } else {
            const divs = await page.$$(
              `div[data-testid='pdp-reviews-modal-scrollable-panel'] div`
            );
            if (divs.length > 0) {
              const lastDiv = divs[divs.length - 1];
              await lastDiv.scrollIntoViewIfNeeded();
              await page.waitForLoadState("networkidle");
            }
          }
        });
      }
    });

    let reviews: ListingReviewExtraction[] = [];

    const buttons = await page.$$(
      'div[data-section-id="TITLE_DEFAULT"] button'
    );
    let reviewBtnFound = false;
    let totalReviews = 0;
    for (const button of buttons) {
      const buttonText = await button.textContent();

      if (buttonText.indexOf("review") > -1) {
        const numericChars = buttonText.match(/\d+/g);
        if (numericChars) {
          totalReviews = parseInt(numericChars[0]);
        }
        reviewBtnFound = true;
        await button.click();
        await page.waitForSelector(
          "div[data-testid='pdp-reviews-modal-scrollable-panel'] div div div div h3"
        );
      }
    }
  });
};

const abnbCalendar = async (
  page: Page,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  return new Promise((resolve, reject) => {
    let response: ExtractionRes = {
      extractionId: req.extractionId,
      source: req.source,
      sourceId: req.sourceId,
      userId: req.userId,
      element: ElementToExtract.CALENDAR,
      companyId: req.companyId,
    };

    let days: { available: boolean; date: Date }[] = [];

    page.on("response", (r) => {
      let url = r.url();
      if (
        url
          .trim()
          .indexOf("https://www.airbnb.com/api/v3/PdpAvailabilityCalendar") > -1
      ) {
        r.body().then(async (b) => {
          let reviewsObject = JSON.parse(b.toString());
          let rawAvailability = reviewsObject.data.merlin
            .pdpAvailabilityCalendar.calendarMonths as {
            month: number;
            year: number;
            days: { calendarDate: string; available: boolean }[];
          }[];

          for (const month of rawAvailability) {
            for (const day of month.days) {
              let current: { available: boolean; date: Date } = {
                available: day.available,
                date: DateTime.fromObject({
                  year: month.year,
                  month: month.month,
                  day: parseInt(day.calendarDate.split("-")[2]),
                }).toJSDate(),
              };
              days.push(current);
            }
          }

          response.calendar = days;

          resolve(response);
        });
      }
    });
  });
};

const abnbGallery = async (
  page: Page,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: ElementToExtract.GALLERY,
    companyId: req.companyId,
  };

  await page.waitForLoadState("networkidle");

  const buttons = await page.$$('div[data-section-id="HERO_DEFAULT"] button');

  for (const button of buttons) {
    const buttonText = await button.textContent();

    if (buttonText.toLowerCase().indexOf("show all photos") > -1) {
      await button.click();
    }
  }

  await page.waitForLoadState("networkidle");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("div[data-testid='photo-viewer-section'] img");

  const overview = await page.$$('div[data-testid="photo-viewer-overview"]');
  let images: string[] = [];
  if (overview.length > 0) {
    const overviewBtns = await page.$$(
      'div[data-testid="photo-viewer-overview"] button'
    );
    for (const btn of overviewBtns) {
      await btn.click();
      await page.waitForLoadState("networkidle");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(800);
      const photoViewerSections = await page.$$(
        "div[data-testid='photo-viewer-section']"
      );
      for (const section of photoViewerSections) {
        const photoViewerSectionsImages = await section.$$(`img`);
        for (const image of photoViewerSectionsImages) {
          let url = await image.getAttribute("src");
          let cleanUrl = url.split("?")[0];
          if (images.find((x) => x === cleanUrl) === undefined) {
            images.push(cleanUrl);
          }
        }
      }
    }
  } else {
    const imgBtns = await page.$$(
      'div[data-testid="photo-viewer-section"] button'
    );
    for (const btn of imgBtns) {
      await btn.scrollIntoViewIfNeeded();
      await page.waitForLoadState("networkidle");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(700);

      const photoViewerSectionsImages = await page.$$(
        `div[data-testid="photo-viewer-section"] img`
      );
      for (const image of photoViewerSectionsImages) {
        let url = await image.getAttribute("src");
        let cleanUrl = url.split("?")[0];
        if (images.find((x) => x === cleanUrl) === undefined) {
          images.push(cleanUrl);
        }
      }
    }
  }

  let photoGallery = await saveRemoteImagesToS3V2(req.sourceId, images);

  response.gallery = photoGallery;

  return response;
};

const abnbSearch = async (
  page: Page,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: ElementToExtract.SEARCH,
    companyId: req.companyId,
  };
return new Promise(async (resolve,reject)=>{
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
  const totalPages=Math.ceil(prices.count/18);
  let currentPage=1;

  const nextBtnSelector = "a[aria-label='Next']"; 
  await page.waitForLoadState("networkidle");
  await page.waitForSelector(nextBtnSelector)

  const deferredStateText = await page
    .locator("#data-deferred-state")
    .textContent();
  const deferredStateJson = JSON.parse(
    deferredStateText
  ) as SearchResponseInitialState;

  let initialSearchResults =
    deferredStateJson.niobeMinimalClientData[0][1].data.presentation.explore
      .sections.sectionIndependentData.staysSearch.searchResults;

  if (initialSearchResults) {
    if (initialSearchResults.length > 0) {
      for (const searchItem of initialSearchResults) {
        let item: ListingSearchExtraction | null = null;
        if (searchItem.listing !== undefined) {
          item = {
            isNew:
              searchItem.listing.avgRatingLocalized === null
                ? false
                : searchItem.listing.avgRatingLocalized.toLowerCase() === "new"
                ? true
                : false,
            avgRating:
              searchItem.listing.avgRatingLocalized === null
                ? 0
                : searchItem.listing.avgRatingLocalized.toLowerCase() === "new"
                ? 0
                : parseFloat(
                    searchItem.listing.avgRatingLocalized.split(" ")[0]
                  ),
            coordinate: {
              latitude: searchItem.listing.coordinate.latitude,
              longitude: searchItem.listing.coordinate.longitude,
            },
            id: searchItem.listing.id,
            name: searchItem.listing.name,
            price:
              searchItem.pricingQuote.structuredStayDisplayPrice.primaryLine
                .price === undefined
                ? parseFloat(
                    searchItem.pricingQuote.structuredStayDisplayPrice.primaryLine.originalPrice
                      .replace("USD", "")
                      .replace("$", "")
                      .trim()
                  )
                : parseFloat(
                    searchItem.pricingQuote.structuredStayDisplayPrice.primaryLine.price
                      .replace("USD", "")
                      .replace("$", "")
                      .trim()
                  ),
          };

          listings.push(item);
        }
      }
    }
  }

  
  const nextBtn = page.locator(nextBtnSelector).nth(0);
  if (nextBtn) {
    await nextBtn.click();
   
    page.on("response", (r) => {
      let url = r.url();
      if (
        url.trim().indexOf("https://www.airbnb.com/api/v3/StaysSearch") > -1
      ) {
        r.body().then(async (b) => {
          let search = JSON.parse(b.toString()) as AbnbSearchResponse;

          let data =
            search.data.presentation.explore.sections.sectionIndependentData
              .staysSearch.searchResults;

          if (data) {
            if (data.length > 0) {
              for (const searchItem of data) {
                let item: ListingSearchExtraction | null = null;
                if (searchItem.listing !== undefined) {
                  item = {
                    isNew:
                      searchItem.listing.avgRatingLocalized === null
                        ? false
                        : searchItem.listing.avgRatingLocalized.toLowerCase() ===
                          "new"
                        ? true
                        : false,
                    avgRating:
                      searchItem.listing.avgRatingLocalized === null
                        ? 0
                        : searchItem.listing.avgRatingLocalized.toLowerCase() ===
                          "new"
                        ? 0
                        : parseFloat(
                            searchItem.listing.avgRatingLocalized.split(" ")[0]
                          ),
                    coordinate: {
                      latitude: searchItem.listing.coordinate.latitude,
                      longitude: searchItem.listing.coordinate.longitude,
                    },
                    id: searchItem.listing.id,
                    name: searchItem.listing.name,
                    price:
                      searchItem.pricingQuote.structuredStayDisplayPrice
                        .primaryLine.price === undefined
                        ? parseFloat(
                            searchItem.pricingQuote.structuredStayDisplayPrice.primaryLine.originalPrice
                              .replace("USD", "")
                              .replace("$", "")
                              .trim()
                          )
                        : parseFloat(
                            searchItem.pricingQuote.structuredStayDisplayPrice.primaryLine.price
                              .replace("USD", "")
                              .replace("$", "")
                              .trim()
                          ),
                  };

                  listings.push(item);
                }
              }
            }
          }

          const btnSelector = "a[aria-label='Next']";
         await page.waitForSelector(btnSelector)
          const onResponseNextBtn = page.locator(btnSelector).nth(0);
          
          if(onResponseNextBtn){
            currentPage++;
            if(totalPages===currentPage){
              response.search=listings
              resolve(response)
            }else{
              await onResponseNextBtn.click()
            }
          }
        });
      }
    });
  }
})
  
};
// UTILITIES

const priceRangeLookupOutsideScale = async (maxSeed: number, page: Page) => {
  let ranges: { min: number; max: number; count: number }[] = [];

  let innerMin = maxSeed;
  let innerMax = maxSeed + 100;
  let noPlacesAvailable = false;
  while (noPlacesAvailable === false) {
    await page.fill("#price_filter_min", innerMin.toString());
    await page.fill("#price_filter_max", innerMax.toString());
    const input = await page.$("#price_filter_max");
    if (input !== null) {
      await input.evaluate((element) => element.blur());
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
      let btnListings = await page.textContent(
        'a[data-testid="filter-modal-confirm"]'
      );
      if (btnListings !== null) {
        let numericChars = btnListings.replace(/\D/g, "");
        if (numericChars.length > 0) {
          let listings = parseInt(numericChars);
          ranges.push({ min: innerMin, max: innerMax, count: listings });
          innerMin = innerMax;
          innerMax = innerMax + 100;
        } else {
          noPlacesAvailable = true;
        }
      }
    }
  }

  return ranges;
};

const priceRangeLookupInsideScale = async (
  minSeed: number,
  maxSeed: number,
  page: Page
) => {
  let ranges: { min: number; max: number; count: number }[] = [];

  let innerMax = maxSeed;
  let lowerRangeFound = false;

  while (lowerRangeFound === false) {
    let parentListings = await extractReducerListingCount(
      minSeed,
      innerMax,
      page
    );
    if (parentListings <= 270) {
      ranges.push({ min: minSeed, max: innerMax, count: parentListings });

      lowerRangeFound = true;
    } else {
      let parentRangeDiff = innerMax - minSeed;
      if (parentRangeDiff <= 1) {
        ranges.push({ min: minSeed, max: innerMax, count: parentListings });

        lowerRangeFound = true;
      } else {
        let higherRangeFound = false;
        let minChild = minSeed;
        let childListings = 0;
        while (higherRangeFound === false) {
          minChild = innerMax - Math.trunc((innerMax - minChild) / 2.1);
          childListings = await extractReducerListingCount(
            minChild,
            innerMax,
            page
          );

          let childRangeDiff = innerMax - minChild;
          if (childListings <= 270) {
            ranges.push({
              min: minChild,
              max: innerMax,
              count: childListings,
            });
            innerMax = minChild - 1;
            higherRangeFound = true;
          } else if (childRangeDiff <= 1) {
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

const extractReducerListingCount = async (
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
      'a[data-testid="filter-modal-confirm"]'
    );
    if (btnListings !== null) {
      listings = parseInt(btnListings.replace(/\D/g, ""));
    }
  }

  return listings;
};
