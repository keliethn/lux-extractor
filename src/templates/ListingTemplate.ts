import { LookupTemplate } from "../fn";

export const ListingTemplate: LookupTemplate = {
  hostId:{
    parent:{attribute:"data-section-id",value:"HOST_PROFILE_DEFAULT"},
    from: "a",
    select: "href",
    where: { href:/\/users\/show\/\d+/gm },
    returnType: "string",
    stringTransformer:/\d+/gm,
    singleValue: true,
  },
  title: {
    parent:{attribute:"data-section-id",value:"TITLE_DEFAULT"},
    from: "h1",
    select: "innerText",
    returnType: "string",
    singleValue: true,
  },
  thumbnail:{
    parent:{attribute:"data-section-id",value:"HERO_DEFAULT"},
    from: "img",
    select: "data-original-uri",
    where: { id:"FMP-target" },
    returnType: "string",
    singleValue: true,
  },
  description: {
    parent: {
      attribute: "data-section-id",
      value: "DESCRIPTION_DEFAULT",
    },
    from: "span",
    select: "innerText",
    where: { innerText: { length: { greaterThan: 0 } } },
    returnType: "string",
    singleValue: true,
  },
  maxOccupancy: {
    parent: {
      attribute: "data-section-id",
      value: "OVERVIEW_DEFAULT",
    },
    from: "span",
    select: "innerText",
    returnType: "integer",
    where: { innerText: RegExp("[1-9]{1,2} guest(s)?") },
    singleValue: true,
  },
  bedrooms: {
    parent: {
      attribute: "data-section-id",
      value: "OVERVIEW_DEFAULT",
    },
    from: "span",
    select: "innerText",
    returnType: "integer",
    where: { innerText: RegExp("[1-9]{1,2} bedroom(s)?") },
    singleValue: true,
  },
  beds: {
    parent: {
      attribute: "data-section-id",
      value: "OVERVIEW_DEFAULT",
    },
    from: "span",
    select: "innerText",
    returnType: "integer",
    where: { innerText: RegExp("[1-9]{1,2} beds") },
    singleValue: true,
  },
  baths: {
    parent: {
      attribute: "data-section-id",
      value: "OVERVIEW_DEFAULT",
    },
    from: "span",
    select: "innerText",
    returnType: "float",
    where: { innerText: RegExp("[1-9]{1,2} bath(s)?") },
    singleValue: true,
  },
  costPerNight: {
    parent: {
      attribute: "data-section-id",
      value: "BOOK_IT_SIDEBAR",
    },
    from: "span",
    select: "innerText",
    returnType: "float",
    where: { innerText: RegExp("$[0-9]{2,7} USD") },
    singleValue: true,
  },
  totalReviews: {
    parent: {
      attribute: "data-section-id",
      value: "TITLE_DEFAULT",
    },
    from: "button",
    select: "innerText",
    returnType: "integer",
    where: { innerText: RegExp("[1-9]{1,4} review(s)?") },
    singleValue: true,
  },
};
