import {
  ListingAmbientExtraction,
  ListingExtractionDetails,
  ListingGalleryExtraction,
  ListingReviewExtraction,
} from "./types";

export class Listing {
  details: ListingExtractionDetails;
  gallery: ListingGalleryExtraction[];
  reviews: ListingReviewExtraction[];
  ambients: ListingAmbientExtraction[];

  constructor() {
    this.details = {
      title: "",
      baths: 0,
      bedrooms: 0,
      beds: 0,
      costPerNight: 0,
      description: "",
      maxOccupancy: 0,
      photos:[]
    };
    this.gallery = [];
    this.reviews = [];
    this.ambients = [];
  }
}
