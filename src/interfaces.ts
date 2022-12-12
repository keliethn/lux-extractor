import { Listing } from "./classes";
import { ListingSource, ElementToExtract } from "./enums";
import { ListingAmbientExtraction, ListingCalendarExtraction, ListingExtractionDetails, ListingGalleryExtraction, ListingReviewExtraction, User, UserListing } from "./types";


export interface ExtractionReq {
  source: ListingSource;
  sourceId: string;
  sourceCount:number;
  sourceData:{key:string,value:string}[];
  element: ElementToExtract;
  userId: string;
  extractionId: string;
  companyId: string;
}

export interface ExtractionRes {
  extractionId: string;
  userId: string;
  source: ListingSource;
  sourceId: string;
  element: ElementToExtract;
  details?: ListingExtractionDetails;
  gallery?: ListingGalleryExtraction[];
  reviews?: ListingReviewExtraction[];
  ambients?: ListingAmbientExtraction[];
  calendar?: ListingCalendarExtraction[];
  userListings?:UserListing[];
  user?:User;
  vrboListing?: Listing;
}

export interface RabbitMqEvent {
  eventSource: string;
  eventSourceArn: string;
  rmqMessagesByQueue: rmqMessageQueue;
}

interface rmqMessageQueue {
  [key: string]: rmqMessage[];
}

interface rmqMessage {
  basicProperties: rmqMsgBasic;
  redelivered: boolean;
  data: string;
}

interface rmqMsgBasic {
  contentType: string;
  contentEncoding: string | null;
  headers: rmqMsgHeaders;
  deliveryMode: number;
  priority: number;
  correlationId: string | null;
  replyTo: string | null;
  expiration: string;
  messageId: string | null;
  timestamp: string;
  type: string | null;
  userId: string;
  appId: string | null;
  clusterId: string | null;
  bodySize: number;
}

interface rmqMsgHeaders {
  [key: string]: {
    bytes: number[];
  };
}
