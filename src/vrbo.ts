import { DateTime } from "luxon";
import { APIRequestContext, Browser, Page } from "playwright-chromium";
import { ElementToExtract } from "./enums";
import {
  saveRemoteImagesToS3,
  Vrbo_getAvailalibity,
  Vrbo_getListing,
  Vrbo_getListingSearch,
  Vrbo_getReviews,
  Vrbo_getUser,
} from "./fn";
import { ExtractionReq, ExtractionRes, VrboSearchRequest } from "./interfaces";
import {
  AbnbUser,
  ListingCalendarExtraction,
  ListingGalleryExtraction,
} from "./types";

export const vrboExtraction = async (
  browser: Browser,
  req: ExtractionReq
  // dataSource: DataSource
): Promise<ExtractionRes> => {
  return new Promise(async (resolve, reject) => {
    let response: ExtractionRes;

    const page = await browser.newPage();
    const context = page.context();

    // await page.goto(`https://www.vrbo.com/${req.sourceId}`, {
    //   timeout: 80000,
    // });
    // let sourceIdArray=req.sourceId.split('-');
    // const listingId=sourceIdArray[0];
    // const sourceId=sourceIdArray[1];
    if (
      req.element === ElementToExtract.LISTING ||
      req.element === ElementToExtract.VRBO_LISTING
    ) {
      await page.goto(`https://www.vrbo.com/${req.sourceId}`, {
        timeout: 80000,
      });
    } else {
      await page.goto(`https://www.vrbo.com`, {
        timeout: 80000,
      });
    }

    // await page.waitForLoadState("networkidle");
    const api = context.request;
    try {
      switch (req.element) {
        case ElementToExtract.PRICE_RANGE_LOOKUP:
          let obj = await getElementText(page);
          if (obj !== "") {
            let ob = obj && JSON.parse(obj);
            let countReviewsSl = ob.reviewsReducer.reviewCount;
            let listingIdSl = ob.listingReducer.listingId;
            response=await vrboLookup(api,req,listingIdSl,countReviewsSl)
          }
          break;
        case ElementToExtract.HOST:
          response = await vrboUser(api, req);
          break;
        case ElementToExtract.LISTING:
          let detailsObj = await getElementText(page);
          let dobj = detailsObj && JSON.parse(detailsObj);
          let countReviewsDetails = dobj.reviewsReducer.reviewCount;
          let listingIdDetails = dobj.listingReducer.listingId;
          response = await vrboDetails(
            api,
            req,
            listingIdDetails,
            countReviewsDetails
          );
          break;
        case ElementToExtract.REVIEWS:
          response = await vrboReviews(api, req);
          break;
        case ElementToExtract.CALENDAR:
          response = await vrboCalendar(api, req);
          break;
        case ElementToExtract.GALLERY:
          response = await vrboGallery(api, req);
          break;
        case ElementToExtract.SEARCH:
          response = await vrboSearch(page, api, req);
          break;
        case ElementToExtract.VRBO_LISTING:
          let slObj = await getElementText(page);
          if (slObj !== "") {
            let sobj = slObj && JSON.parse(slObj);
            let countReviewsSl = sobj.reviewsReducer.reviewCount;
            let listingIdSl = sobj.listingReducer.listingId;
            response = await vrboSingleListing(
              api,
              req,
              listingIdSl,
              countReviewsSl
            );
          } else {
            response = {
              extractionId: req.extractionId,
              source: req.source,
              sourceId: req.sourceId,
              userId: req.userId,
              element: req.element,
              companyId: req.companyId,
            };
          }

          break;
        default:
          break;
      }
    } catch (err: any) {
      reject(err);
    }

    await browser.close();

    resolve(response);
  });
};

const vrboLookup = async (
  api: APIRequestContext,
  req: ExtractionReq,
  listingId: string,
  reviewsCount?: number
): Promise<ExtractionRes> => {
  let response = await vrboSingleListing(api, req, listingId, reviewsCount);
  return response;
};

const getElementText = async (page: Page): Promise<string | null> => {
  return new Promise(async (resolve, reject) => {
    let elements = await page
      .locator("script:not([type]):not([src]):not([async])")
      .allTextContents();
    let obj = "";
    for (const element of elements) {
      //let textContent = await element.textContent();
      let elementText = element && element.trim();

      let stringMatch =
        elementText &&
        elementText.substring(0, 51).match(/window.__INITIAL_STATE__/gm);
      if (stringMatch !== null) {
        obj =
          elementText && elementText.slice(27, elementText.length - 118).trim();
      }
    }
    resolve(obj);
  });
};

const vrboUser = async (
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
  let usr = await Vrbo_getUser(api, req.sourceId);
  response.host = {
    id: usr.user.id.toString(),
    firstName: usr.user.first_name,
    lastName: "",
    about: usr.user.about,
    listingsCount: usr.user.listings_count,
    totalListingsCount: usr.user.total_listings_count,
    pictureUrl: usr.user.picture_url,
    thumbnailUrl: usr.user.thumbnail_url,
    createdAt: DateTime.fromISO(usr.user.created_at).toJSDate(),
    revieweeCount: usr.user.reviewee_count,
    isSuperhost: true,
  };

  return response;
};

const vrboDetails = async (
  api: APIRequestContext,
  req: ExtractionReq,
  listingId: string,
  reviewsCount?: number
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
    companyId: req.companyId,
  };
  let unit = await Vrbo_getListing(api, listingId, reviewsCount);

  let thumbnailImgName: string;
  let imgString = unit.listing.thumbnail_url.replace("https://", "");
  if (imgString !== null) {
    let imgArray = imgString.split("/");
    let imgArrayItem = imgArray[imgArray.length - 1];
    if (imgArrayItem !== null) {
      let imgId = imgArrayItem.split(".")[0];
      thumbnailImgName = `${req.sourceId}-${imgId}.webp`;
    }
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
    roomType: unit.listing.room_type_category,
    thumbnail: thumbnailImgName,
    photos: unit.listing.photos.map((x) => {
      let imgString = x.uri.replace("https://", "");
      if (imgString !== null) {
        let imgArray = imgString.split("/");
        let imgArrayItem = imgArray[imgArray.length - 1];
        if (imgArrayItem !== null) {
          let imgId = imgArrayItem.split(".")[0];
          let url = x.uri.replace(imgArrayItem, imgId + ".jpg");

          let img: ListingGalleryExtraction = {
            ambient: "",
            imageId: imgId,
            origin: url,
            objectKey: `${req.sourceId}-${imgId}.webp`,
            caption: x.caption === null ? "" : x.caption,
          };

          return img;
        }
      }
    }),
  };

  return response;
};

const vrboReviews = async (
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

  let reviews = await Vrbo_getReviews(api, req.sourceId, req.sourceCount);

  response.reviews = reviews;

  return response;
};

const vrboCalendar = async (
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

  let availability = await Vrbo_getAvailalibity(api, req.sourceId);

  if (availability.calendar !== undefined) {
    response.calendar = availability.calendar.days.map((d) => {
      let r: ListingCalendarExtraction = {
        available: d.available,
        date: DateTime.fromISO(d.date).toJSDate(),
      };
      return r;
    });
  } else {
    response.calendar = [];
  }

  return response;
};

const vrboGallery = async (
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

  let gallery = await saveRemoteImagesToS3(api, req.sourceId, req.sourceData);

  response.gallery = gallery;

  return response;
};

const vrboSearch = async (
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
    companyId: req.companyId,
  };

  let newRequest: VrboSearchRequest = {
    operationName: "SearchRequestQuery",
    query: `query SearchRequestQuery($request: SearchResultRequest!, $filterCounts: Boolean!, $optimizedBreadcrumb: Boolean!, $vrbo_web_global_messaging_banner: Boolean!) {  results: search(request: $request) {    ...querySelectionSet    ...DestinationBreadcrumbsSearchResult    ...DestinationMessageSearchResult    ...FilterCountsSearchRequestResult    ...HitCollectionSearchResult    ...ADLSearchResult    ...MapSearchResult    ...ExpandedGroupsSearchResult    ...PagerSearchResult    ...InternalToolsSearchResult    ...SEOMetaDataParamsSearchResult    ...GlobalInlineMessageSearchResult    ...GlobalBannerContainerSearchResult @include(if: $vrbo_web_global_messaging_banner)    __typename  }}fragment querySelectionSet on SearchResult {  id  typeaheadSuggestion {    uuid    term    name    __typename  }  geography {    lbsId    gaiaId    location {      latitude      longitude      __typename    }    isGeocoded    shouldShowMapCentralPin    __typename  }  propertyRedirectUrl  __typename}fragment DestinationBreadcrumbsSearchResult on SearchResult {  destination(optimizedBreadcrumb: $optimizedBreadcrumb) {    breadcrumbs {      name      url      __typename    }    __typename  }  __typename}fragment HitCollectionSearchResult on SearchResult {  page  pageSize  pageCount  queryUUID  percentBooked {    currentPercentBooked    __typename  }  listings {    ...HitListing    __typename  }  resultCount  pinnedListing {    headline    listing {      ...HitListing      __typename    }    __typename  }  __typename}fragment HitListing on Listing {  virtualTourBadge {    name    id    helpText    __typename  }  amenitiesBadges {    name    id    helpText    __typename  }  images {    altText    c6_uri    c9_uri    mab {      banditId      payloadId      campaignId      cached      arm {        level        imageUrl        categoryName        __typename      }      __typename    }    __typename  }  ...HitInfoListing  __typename}fragment HitInfoListing on Listing {  listingId  ...HitInfoDesktopListing  ...HitInfoMobileListing  ...PriceListing  __typename}fragment HitInfoDesktopListing on Listing {  detailPageUrl  instantBookable  minStayRange {    minStayHigh    minStayLow    __typename  }  listingId  listingNumber  rankedBadges(rankingStrategy: SERP) {    id    helpText    name    __typename  }  propertyId  propertyMetadata {    headline    __typename  }  superlativesBadges: rankedBadges(rankingStrategy: SERP_SUPERLATIVES) {    id    helpText    name    __typename  }  unitMetadata {    unitName    __typename  }  webRatingBadges: rankedBadges(rankingStrategy: SRP_WEB_RATING) {    id    helpText    name    __typename  }  ...DetailsListing  ...GeoDistanceListing  ...PriceListing  ...RatingListing  __typename}fragment DetailsListing on Listing {  bathrooms {    full    half    toiletOnly    __typename  }  bedrooms  propertyType  sleeps  petsAllowed  spaces {    spacesSummary {      area {        areaValue        __typename      }      bedCountDisplay      __typename    }    __typename  }  __typename}fragment GeoDistanceListing on Listing {  geoDistance {    text    relationType    __typename  }  __typename}fragment PriceListing on Listing {  priceSummary: priceSummary {    priceAccurate    ...PriceSummaryTravelerPriceSummary    __typename  }  priceSummarySecondary: priceSummary(summary: "displayPriceSecondary") {    ...PriceSummaryTravelerPriceSummary    __typename  }  priceLabel: priceSummary(summary: "priceLabel") {    priceTypeId    pricePeriodDescription    __typename  }  prices {    ...VrboTravelerPriceSummary    __typename  }  __typename}fragment PriceSummaryTravelerPriceSummary on TravelerPriceSummary {  priceTypeId  edapEventJson  formattedAmount  roundedFormattedAmount  pricePeriodDescription  __typename}fragment VrboTravelerPriceSummary on PriceSummary {  perNight {    amount    formattedAmount    roundedFormattedAmount    pricePeriodDescription    __typename  }  total {    amount    formattedAmount    roundedFormattedAmount    pricePeriodDescription    __typename  }  label  mainPrice  __typename}fragment RatingListing on Listing {  averageRating  reviewCount  __typename}fragment HitInfoMobileListing on Listing {  detailPageUrl  instantBookable  minStayRange {    minStayHigh    minStayLow    __typename  }  listingId  listingNumber  rankedBadges(rankingStrategy: SERP) {    id    helpText    name    __typename  }  propertyId  propertyMetadata {    headline    __typename  }  superlativesBadges: rankedBadges(rankingStrategy: SERP_SUPERLATIVES) {    id    helpText    name    __typename  }  unitMetadata {    unitName    __typename  }  webRatingBadges: rankedBadges(rankingStrategy: SRP_WEB_RATING) {    id    helpText    name    __typename  }  ...DetailsListing  ...GeoDistanceListing  ...PriceListing  ...RatingListing  __typename}fragment ExpandedGroupsSearchResult on SearchResult {  expandedGroups {    ...ExpandedGroupExpandedGroup    __typename  }  __typename}fragment ExpandedGroupExpandedGroup on ExpandedGroup {  listings {    ...HitListing    ...MapHitListing    __typename  }  mapViewport {    neLat    neLong    swLat    swLong    __typename  }  __typename}fragment MapHitListing on Listing {  ...HitListing  geoCode {    latitude    longitude    __typename  }  __typename}fragment FilterCountsSearchRequestResult on SearchResult {  id  resultCount  filterGroups {    groupInfo {      name      id      __typename    }    filters {      count @include(if: $filterCounts)      checked      filter {        id        name        refineByQueryArgument        description        __typename      }      __typename    }    __typename  }  __typename}fragment MapSearchResult on SearchResult {  mapViewport {    neLat    neLong    swLat    swLong    __typename  }  page  pageSize  listings {    ...MapHitListing    __typename  }  pinnedListing {    listing {      ...MapHitListing      __typename    }    __typename  }  __typename}fragment PagerSearchResult on SearchResult {  fromRecord  toRecord  pageSize  pageCount  page  resultCount  __typename}fragment DestinationMessageSearchResult on SearchResult {  destinationMessage(assetVersion: 4) {    iconTitleText {      title      message      icon      messageValueType      link {        linkText        linkHref        __typename      }      __typename    }    ...DestinationMessageDestinationMessage    __typename  }  __typename}fragment DestinationMessageDestinationMessage on DestinationMessage {  iconText {    message    icon    messageValueType    __typename  }  __typename}fragment ADLSearchResult on SearchResult {  parsedParams {    q    coreFilters {      adults      children      pets      minBedrooms      maxBedrooms      minBathrooms      maxBathrooms      minNightlyPrice      maxNightlyPrice      minSleeps      __typename    }    dates {      arrivalDate      departureDate      __typename    }    sort    __typename  }  page  pageSize  pageCount  resultCount  fromRecord  toRecord  pinnedListing {    listing {      listingId      __typename    }    __typename  }  listings {    listingId    __typename  }  filterGroups {    filters {      checked      filter {        groupId        id        __typename      }      __typename    }    __typename  }  geography {    lbsId    name    description    location {      latitude      longitude      __typename    }    primaryGeoType    breadcrumbs {      name      countryCode      location {        latitude        longitude        __typename      }      primaryGeoType      __typename    }    __typename  }  __typename}fragment InternalToolsSearchResult on SearchResult {  internalTools {    searchServiceUrl    __typename  }  __typename}fragment SEOMetaDataParamsSearchResult on SearchResult {  page  resultCount  pageSize  geography {    name    lbsId    breadcrumbs {      name      __typename    }    __typename  }  __typename}fragment GlobalInlineMessageSearchResult on SearchResult {  globalMessages {    ...GlobalInlineAlertGlobalMessages    __typename  }  __typename}fragment GlobalInlineAlertGlobalMessages on GlobalMessages {  alert {    action {      link {        href        text {          value          __typename        }        __typename      }      __typename    }    body {      text {        value        __typename      }      link {        href        text {          value          __typename        }        __typename      }      __typename    }    id    severity    title {      value      __typename    }    __typename  }  __typename}fragment GlobalBannerContainerSearchResult on SearchResult {  globalMessages {    ...GlobalBannerGlobalMessages    __typename  }  __typename}fragment GlobalBannerGlobalMessages on GlobalMessages {  banner {    body {      text {        value        __typename      }      link {        href        text {          value          __typename        }        __typename      }      __typename    }    id    severity    title {      value      __typename    }    __typename  }  __typename}`,
    variables: {
      filterCounts: false,
      optimizedBreadcrumb: false,
      request: {
        coreFilters: {
          maxBathrooms: null,
          maxBedrooms: null,
          maxNightlyPrice: null,
          maxTotalPrice: null,
          minBathrooms: 0,
          minBedrooms: 0,
          minNightlyPrice: 0,
          minTotalPrice: null,
          pets: 0,
        },
        filters: [],
        filterVersion: "1",
        paging: {
          page: 1,
          pageSize: 10,
        },
        q: req.sourceId,
      },
      vrbo_web_global_messaging_banner: true,
    },
    extensions: {
      isPageLoadSearch: true,
    },
  };
  let pageResults = await Vrbo_getListingSearch(api, newRequest);

  response.search = pageResults;

  return response;
};

const vrboSingleListing = async (
  api: APIRequestContext,
  req: ExtractionReq,
  listingId: string,
  reviewsCount?: number
): Promise<ExtractionRes> => {
  let response: ExtractionRes = {
    extractionId: req.extractionId,
    source: req.source,
    sourceId: req.sourceId,
    userId: req.userId,
    element: req.element,
    companyId: req.companyId,
  };
  let unit = await Vrbo_getListing(api, listingId, reviewsCount);
  let usr: AbnbUser;
  if (unit.listing !== undefined) {
    usr = await Vrbo_getUser(api, listingId);
    response.host = {
      id: "",
      firstName: usr.user.first_name,
      lastName: "",
      about: "",
      listingsCount: 0,
      totalListingsCount: 0,
      pictureUrl: "",
      thumbnailUrl: "",
      createdAt: DateTime.fromISO(usr.user.created_at).toJSDate(),
      revieweeCount: 0,
      isSuperhost: false,
    };

    let thumbnailImgName: string;
    let imgString = unit.listing.thumbnail_url.replace("https://", "");
    if (imgString !== null) {
      let imgArray = imgString.split("/");
      let imgArrayItem = imgArray[imgArray.length - 1];
      if (imgArrayItem !== null) {
        let imgId = imgArrayItem.split(".")[0];
        thumbnailImgName = `${req.sourceId}-${imgId}.webp`;
      }
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
      roomType: unit.listing.room_type_category,
      thumbnail: thumbnailImgName,
      photos: unit.listing.photos.map((x) => {
        let imgString = x.uri.replace("https://", "");
        if (imgString !== null) {
          let imgArray = imgString.split("/");
          let imgArrayItem = imgArray[imgArray.length - 1];
          if (imgArrayItem !== null) {
            let imgId = imgArrayItem.split(".")[0];
            let url = x.uri.replace(imgArrayItem, imgId + ".jpg");

            let img: ListingGalleryExtraction = {
              ambient: "",
              imageId: imgId,
              origin: url,
              objectKey: `${req.sourceId}-${imgId}.webp`,
              caption: x.caption === null ? "" : x.caption,
            };

            return img;
          }
        }
        // let response: ListingGalleryExtraction = {
        //   imageId: x.id.toString(),
        //   origin: x.xl_picture,
        //   objectKey: "",
        //   caption: x.caption,
        // };
        // return response;
      }),
    };

    let reviews = await Vrbo_getReviews(
      api,
      listingId,
      unit.listing.reviews_count
    );

    response.reviews = reviews;

    let availability = await Vrbo_getAvailalibity(api, listingId);

    if (availability.calendar !== undefined) {
      response.calendar = availability.calendar.days.map((d) => {
        let r: ListingCalendarExtraction = {
          available: d.available,
          date: DateTime.fromISO(d.date).toJSDate(),
        };
        return r;
      });
    } else {
      response.calendar = [];
    }

    let photos = unit.listing.photos.map((x) => {
      let response = {
        key: x.uri,
        value: x.caption,
      };
      return response;
    });

    let gallery = await saveRemoteImagesToS3(api, req.sourceId, photos);

    response.gallery = gallery;
  }

  return response;
};
