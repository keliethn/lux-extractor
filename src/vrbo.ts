import { Browser, Page } from "playwright-chromium";
import { Listing } from "./classes";
import { ExtractionReq, ExtractionRes } from "./interfaces";
import { ListingGalleryExtraction, ListingReviewExtraction } from "./types";

export const vrboExtraction = async (
  browser: Browser,
  req: ExtractionReq
): Promise<ExtractionRes> => {
  return new Promise(async (resolve, reject) => {
    let listing: Listing = new Listing();

    const page = await browser.newPage();
    const context = page.context();

    await page.goto(`https://www.vrbo.com/${req.sourceId}`,{
      timeout:60000
    });

     await page.waitForLoadState("networkidle");

    let objString = await getElementText(page);
    let obj = objString && JSON.parse(objString);

    obj.listingReducer.images.forEach((image) => {
      let imgString = image.uri.replace("https://", "");
      if (imgString !== null) {
        let imgArray = imgString.split("/");
        let imgArrayItem = imgArray[imgArray.length - 1];
        if (imgArrayItem !== null) {
          let imgId = imgArrayItem.split(".")[0];
          let url = image.uri.replace(imgArrayItem, imgId + ".jpg");

          let img: ListingGalleryExtraction = {
            ambient: "",
            imageId: imgId,
            origin: url,
            objectKey: `${req.sourceId}-${imgId}.webp`,
            caption: image.caption === null ? "" : image.caption,
          };

          listing.gallery.push(img);
        }
      }
    });

    listing.details.title = obj.listingReducer.propertyName;
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

    const request = context.request;

    let resp = await request.post("https://www.vrbo.com/mobileapi/graphql", {
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
          listingId: obj.listingReducer.listingId,
          page: 1,
          pageSize: 30,
        },
        query:
          "query Reviews($isInitial: Boolean = false, $listingId: String!, $page: Int!, $pageSize: Int!) {\n  reviews(listingId: $listingId, page: $page, pageSize: $pageSize) {\n    uuid\n    headline: title\n    rating\n    body: text\n    arrivalDate\n    datePublished\n    ownershipTransferred\n    voteCount\n    reviewLanguage\n    reviewer {\n      location\n      nickname\n      profileUrl\n      __typename\n    }\n    response: reviewResponse {\n      status\n      body\n      language\n      country\n      __typename\n    }\n    source\n    unverifiedDisclaimer\n    __typename\n  }\n  reviewSummary(listingId: $listingId) @include(if: $isInitial) {\n    reviewCount\n    guestbookReviewCount\n    averageRating\n    verificationDisclaimerLinkText\n    verificationDisclaimerLinkUrl\n    verificationDisclaimerText\n    __typename\n  }\n}\n",
      },
    });

    let rawBody = await resp.body();
    let reviewsJson = JSON.parse(rawBody.toString());

    let reviews = reviewsJson.data.reviews;

    listing.reviews = reviews.map((x) => {
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

    let response: ExtractionRes = {
      element: req.element,
      extractionId: req.extractionId,
      source: req.source,
      sourceId: req.sourceId,
      userId: req.userId,
      vrboListing: listing,
    };

    await browser.close();

    resolve(response);

  });
};

const getElementText = async (page: Page): Promise<string | null> => {
  return new Promise(async (resolve, reject) => {
    let elements = await page.$$("script:not([type]):not([src]):not([async])");
    for (const element of elements) {
      let textContent = await element.textContent();
      let elementText = textContent && textContent.trim();

      let stringMatch =
        elementText &&
        elementText.substring(0, 51).match(/window.__INITIAL_STATE__/gm);
      if (stringMatch !== null) {
        let obj =
          elementText && elementText.slice(27, elementText.length - 118).trim();
        resolve(obj);
      }
    }
  });
};
