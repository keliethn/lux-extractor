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
  niobeMinimalClientData: [string, object][]; //SearResponse Type... look for index 1
}

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
    isInitialLoad: boolean; //true
    hasLoggedIn: boolean; //false
    cdnCacheSafe: boolean; //false
    source: string; // EXPLORE
    staysSearchRequest: {
      requestedPageType: string; // STAYS_SEARCH
      cursor: string;
      metadataOnly: boolean; //false
      searchType: string; // unknown
      treatmentFlags: string[];
      rawParams: { filterName: string; filterValues: string[] }[];
    };
    staysSearchM3Enabled: boolean; //false
    staysSearchM6Enabled: boolean; //false
    feedMapDecoupleEnabled: boolean; //false
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
