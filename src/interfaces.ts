import { Listing } from "./classes";
import { ListingSource, ElementToExtract } from "./enums";
import {
  ListingAmbientExtraction,
  ListingCalendarExtraction,
  ListingExtractionDetails,
  ListingExtractionHost,
  ListingGalleryExtraction,
  ListingReviewExtraction,
  ListingSearchExtraction,
  PriceRangeLookup,
  User,
} from "./types";

export interface ExtractionReq {
  source: ListingSource;
  sourceId: string;
  sourceCount: number;
  sourceData: { key: string; value: string }[];
  element: ElementToExtract;
  userId: string;
  extractionId: string;
  companyId: string;
}

export interface ExtractionRes {
  extractionId: string;
  userId: string;
  companyId: string;
  source: ListingSource;
  sourceId: string;
  reference?: string;
  element: ElementToExtract;
  details?: ListingExtractionDetails;
  host?: ListingExtractionHost;
  gallery?: ListingGalleryExtraction[];
  reviews?: ListingReviewExtraction[];
  ambients?: ListingAmbientExtraction[];
  calendar?: ListingCalendarExtraction[];
  search?: ListingSearchExtraction[];
  lookup?: PriceRangeLookup;
  error?: string;
  userListings?: ListingSearchExtraction[];
  user?: User;
  vrboListing?: Listing;
}

export interface SQSEvent {
  Records: sqsMessage[];
}

interface sqsMessage {
  messageId: string;
  receiptHandle: string;
  body: string;
  attributes: object[];
  messageAttributes: {};
  md5OfBody: string;
  eventSource: string;
  eventSourceARN: string;
  awsRegion: string;
}

export interface SearchResponseInitialState {
  niobeMinimalClientData: [string, AbnbSearchResponse][]; //SearResponse Type... look for index 1
}

export interface HostResponseInitialState {
  niobeMinimalClientData: [string, AbnbHostResponse][];
}

export interface AbnbHostResponse {
  data: {
    presentation: {
      userProfileContainer: {
        userProfile: {
          about: string;
          createdAt: string;
          guestType: string;
          isHomeHost: boolean;
          isSuperhost: boolean;
          managedListingsTotalCount: number;
          profilePictureUrl: string;
          smartName: string;
          reviewsReceivedFromGuests: {
            count: number;
          };
          userId: string;
          timeAsHost: {
            years: number;
            months: number;
          };
          timeAsUser: {
            years: number;
            months: number;
          };
          managedListings: {
            id: string;
            bathrooms: number;
            bedrooms: number;
            beds: number;
            nameOrPlaceholderName: string;
            pictureUrl: string;
            priceAmountCurrency: {
              amount: number;
              currency: string;
            };
            propertyTypeId: string;
            propertyTypeName: string;
            ratingAverage: number;
            reviewCount: string;
          }[];
        };
      };
    };
  };
}

export interface AbnbListingSectionsResponse{
  data:{
    presentation:{
      stayProductDetailPage:{
        sections:{
           sections:{
          sectionId:"PHOTO_TOUR_SCROLLABLE_MODAL" |"DESCRIPTION_DEFAULT"| "OVERVIEW_DEFAULT"| "LOCATION_DEFAULT"|"AVAILABILITY_CALENDAR_DEFAULT"|"TITLE_DEFAULT"|"REVIEWS_DEFAULT";
          section:AbnbListingSectionOverview| AbnbListingSectionDescription| AbnbListingSectionPhotoTour |AbnbListingSectionLocation| AbnbListingSectionCalendar| AbnbListingSectionTitle|AbnbListingSectionReviews
        }[]
        }
       
      }
    }
  }
}

export interface AbnbListingSectionOverview{
  detailItems:{title:string}[]
}

export interface AbnbListingSectionDescription{
  htmlDescription:{htmlText:string}
}

export interface AbnbListingSectionPhotoTour{
  mediaItems:{
    id:string;
    orientation:"LANDSCAPE"|"PORTRAIT"
    baseUrl:string;
    caption?:string
  }[]
}

export interface AbnbListingSectionLocation{
  lat:number;
  lng:number;
}

export interface AbnbListingSectionCalendar{
  thumbnail:{
    baseUrl:string
  };
  maxGuestCapacity:number
}

export interface AbnbListingSectionTitle{
  title:string;
}

export interface AbnbListingSectionReviews{
  overallCount:number;
  overallRating:number;
}

export interface ListingResponseInitialState {}

export interface AbnbSearchResponse {
  data: {
    presentation: {
      explore: {
        sections: {
          sectionIndependentData: {
            staysSearch: {
              searchResults: StayResultItem[];
              paginationInfo: {
                pageCursors: string[];
              };
            };
          };
        };
      };
    };
  };
}

export interface VrboSearchResponse {
  results: {
    resultCount: number;
    page: number;
    pageSize: number;
    pageCount: number;
    listings: {
      averageRating: number;
      geoCode: { latitude: number; longitude: number };
      propertyId: string;
      listingId: string;
      propertyMetadata: { headline: string };
      prices: { perNight: { amount: number } };
    }[];
  };
}

export interface StayResultItem {
  listing: {
    avgRatingLocalized: string;
    coordinate: {
      latitude: number;
      longitude: number;
    };
    id: string;
    name: string;
  };
  pricingQuote: {
    structuredStayDisplayPrice: {
      primaryLine: {
        price: string;
        discountedPrice: string;
        originalPrice: string;
      };
    };
  };
}

export interface AbnbSearchRequest {
  operationName: string; //StaysSearch
  variables: {
    // isInitialLoad: boolean; //true
    // hasLoggedIn: boolean; //false
    // cdnCacheSafe: boolean; //false
    // source: string; // EXPLORE
    staysMapSearchRequestV2: {
      requestedPageType: string; // STAYS_SEARCH
      cursor: string;
      metadataOnly: boolean; //false
      searchType: string; // unknown
      treatmentFlags: string[];
      rawParams: { filterName: string; filterValues: string[] }[];
    };
    staysSearchRequest: {
      requestedPageType: string; // STAYS_SEARCH
      cursor: string;
      metadataOnly: boolean; //false
      searchType: string; // unknown
      treatmentFlags: string[];
      rawParams: { filterName: string; filterValues: string[] }[];
    };
    decomposeCleanupEnabled: boolean; //false
    decomposeFiltersEnabled: boolean; //false
    feedMapDecoupleEnabled: boolean; //true
  };
  extensions: {
    persistedQuery: {
      version: number;
      sha256Hash: string;
    };
  };
}

export interface VrboSearchRequest {
  operationName: string; //StaysSearch
  query: string;
  variables: {
    filterCounts: boolean; //false
    optimizedBreadcrumb: boolean; //false
    request: {
      coreFilters: {
        maxBathrooms?: number;
        maxBedrooms?: number;
        maxNightlyPrice?: number;
        maxTotalPrice?: number;
        minBathrooms: number;
        minBedrooms: number;
        minNightlyPrice: number;
        minTotalPrice?: number;
        pets: number;
      };
      filters: string[];
      filterVersion: string;
      paging: {
        page: number;
        pageSize: number;
      };
      q: string;
    };
    vrbo_web_global_messaging_banner: boolean;
  };
  extensions: {
    isPageLoadSearch: boolean;
  };
}

export interface SearchCursor {
  section_offset: number; //0
  items_offset: number; //0
  version: number; //1
}

export interface SearchQueryString {
  tab_id: string;
  query: string;
  place_id: string;
  price_filter_input_type: string;
  price_filter_num_nights: string;
  federated_search_session_id: string;
  search_type: string;
  pagination_search: string;
  cursor: string;
}
 // --------------------------------------
 export interface ListingsBbox{
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
 }

 export interface ListingsPrice{ min: number; max: number; count: number }